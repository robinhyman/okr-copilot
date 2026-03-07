import { Router } from 'express';
import multer from 'multer';
import { requireMutatingAuth } from '../middleware/auth-guard.js';
import {
  addKrCheckin,
  appendDraftVersion,
  createDraftSession,
  createOkr,
  deleteDraftSession,
  getDraftSessionById,
  getLeaderRollup,
  getOkrTeamIdByKeyResultId,
  listDraftSessions,
  listKrCheckins,
  listManagerDigest,
  listOkrsAcrossTeams,
  listTeamCheckins,
  listOkrsForTeam,
  publishDraftSession,
  updateOkr
} from '../data/okrs-repo.js';
import { createOkrDraftProvider, type OkrConversationMessage } from '../services/ai/okr-draft-provider.js';
import { applyPreviewSelection, buildPreview, parseWorkbook } from '../services/excel/kr-import.js';
import { canCheckin, canManageDrafts, canManageOkrs, canPublishOkrs, canViewTeam, getActorContext, type ActorContext } from '../modules/auth/rbac.js';

export const okrsRouter = Router();
const draftProvider = createOkrDraftProvider();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});
const MAX_OBJECTIVES = 5;
const MAX_KEY_RESULTS_PER_OBJECTIVE = 5;

async function requesterActor(req: any): Promise<ActorContext> {
  return getActorContext(req);
}

function actorTeamIds(actor: ActorContext): string[] {
  return actor.memberships.map((m) => m.teamId);
}

function parseConversationPayload(body: any): { input?: { messages: OkrConversationMessage[]; draft?: any; focusArea?: string; timeframe?: string }; error?: string } {
  const rawMessages = Array.isArray(body?.messages) ? body.messages : [];
  const messages = rawMessages
    .filter((message: any) => message && typeof message.content === 'string' && typeof message.role === 'string')
    .map((message: any) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: String(message.content).trim()
    }))
    .filter((message: OkrConversationMessage) => Boolean(message.content));

  if (!messages.length) {
    return { error: 'messages_required' };
  }

  return {
    input: {
      messages,
      draft: body?.draft,
      focusArea: typeof body?.focusArea === 'string' ? body.focusArea : undefined,
      timeframe: typeof body?.timeframe === 'string' ? body.timeframe : undefined
    }
  };
}

function parseWizardPayload(body: any) {
  const requiredTextFields = ['focusArea', 'timeframe', 'constraints', 'objectiveStatement'] as const;
  for (const field of requiredTextFields) {
    if (typeof body?.[field] !== 'string' || !body[field].trim()) {
      return { error: `invalid_${field}` as const };
    }
  }

  const structuredRaw = body?.baselineStructured && typeof body.baselineStructured === 'object'
    ? body.baselineStructured
    : null;

  const structuredValue = structuredRaw?.value == null ? undefined : Number(structuredRaw.value);
  const structuredUnit = typeof structuredRaw?.unit === 'string' ? structuredRaw.unit.trim() : '';
  const structuredPeriod = typeof structuredRaw?.period === 'string' ? structuredRaw.period.trim() : '';

  const baselineFromStructured =
    Number.isFinite(structuredValue) && structuredUnit
      ? `Current baseline is ${structuredValue} ${structuredUnit}${structuredPeriod ? ` per ${structuredPeriod}` : ''}`
      : '';

  const baseline = typeof body?.baseline === 'string' && body.baseline.trim()
    ? body.baseline.trim()
    : baselineFromStructured;

  if (!baseline) {
    return { error: 'invalid_baseline' as const };
  }

  const keyResultCount = body?.keyResultCount == null ? 3 : Number(body.keyResultCount);
  if (!Number.isFinite(keyResultCount) || keyResultCount < 2 || keyResultCount > 5) {
    return { error: 'invalid_keyResultCount' as const };
  }

  return {
    input: {
      focusArea: body.focusArea.trim(),
      timeframe: body.timeframe.trim(),
      baseline,
      baselineStructured: {
        value: Number.isFinite(structuredValue) ? structuredValue : undefined,
        unit: structuredUnit || undefined,
        period: structuredPeriod || undefined
      },
      constraints: body.constraints.trim(),
      objectiveStatement: body.objectiveStatement.trim(),
      keyResultCount,
      aiAssist: Boolean(body?.aiAssist)
    }
  };
}

function parseOkrPayload(body: any) {
  if (!body || typeof body.objective !== 'string' || typeof body.timeframe !== 'string') {
    return { error: 'invalid_okr_payload' as const };
  }

  const keyResults = Array.isArray(body.keyResults) ? body.keyResults : [];
  if (keyResults.length > MAX_KEY_RESULTS_PER_OBJECTIVE) return { error: 'too_many_key_results' as const };
  if (!keyResults.length) return { error: 'at_least_one_key_result_required' as const };

  for (const kr of keyResults) {
    if (typeof kr.title !== 'string' || !kr.title.trim()) return { error: 'invalid_key_result_title' as const };
    if (!Number.isFinite(Number(kr.targetValue))) return { error: 'invalid_key_result_target' as const };
    if (!Number.isFinite(Number(kr.currentValue))) return { error: 'invalid_key_result_current' as const };
  }

  return {
    input: {
      objective: body.objective.trim(),
      timeframe: body.timeframe.trim(),
      keyResults: keyResults.map((kr: any) => ({
        title: String(kr.title).trim(),
        targetValue: Number(kr.targetValue),
        currentValue: Number(kr.currentValue),
        unit: typeof kr.unit === 'string' && kr.unit.trim() ? kr.unit.trim() : 'points'
      }))
    }
  };
}

function parseOkrSetPayload(body: any) {
  const objectives = Array.isArray(body?.objectives) ? body.objectives : null;
  if (!objectives) return { error: 'invalid_okr_set_payload' as const };
  if (!objectives.length) return { error: 'at_least_one_objective_required' as const };
  if (objectives.length > MAX_OBJECTIVES) return { error: 'too_many_objectives' as const };

  const parsedObjectives = [];
  for (const objectivePayload of objectives) {
    const parsed = parseOkrPayload(objectivePayload);
    if ('error' in parsed) return { error: parsed.error };
    parsedObjectives.push(parsed.input);
  }

  return { input: { objectives: parsedObjectives } };
}

function parseDraftPayload(body: any) {
  if (!body || typeof body.objective !== 'string' || typeof body.timeframe !== 'string' || !Array.isArray(body.keyResults)) {
    return { error: 'invalid_draft_payload' as const };
  }

  const keyResults = body.keyResults
    .map((kr: any) => ({
      title: String(kr?.title ?? '').trim(),
      targetValue: Number(kr?.targetValue),
      currentValue: Number(kr?.currentValue),
      unit: typeof kr?.unit === 'string' && kr.unit.trim() ? kr.unit.trim() : 'points'
    }))
    .filter((kr: any) => kr.title && Number.isFinite(kr.targetValue) && Number.isFinite(kr.currentValue));

  if (!keyResults.length) return { error: 'at_least_one_key_result_required' as const };

  return {
    input: {
      objective: body.objective.trim(),
      timeframe: body.timeframe.trim(),
      keyResults
    }
  };
}

function deriveKrQualityHints(input: { title: string; targetValue: number; currentValue: number; unit: string }, timeframe: string) {
  const hints: string[] = [];
  if (input.title.trim().split(' ').length < 4) hints.push('Make KR title more specific (what metric and by how much).');
  if (!/\d/.test(input.title)) hints.push('Include numeric target context in title for clearer measurability.');
  if (!input.unit || input.unit === 'points') hints.push('Use a concrete unit (%, days, revenue, incidents, etc.).');
  if (input.targetValue === input.currentValue) hints.push('Target equals current value; stretch target slightly for meaningful progress.');
  if (input.targetValue < input.currentValue) hints.push('Target is below current value; ensure this KR is framed as a reduction metric if intentional.');
  if (!/Q[1-4]|month|week|year|20\d{2}/i.test(timeframe)) hints.push('Specify a clearer timeframe (e.g., Q2 2026).');
  return hints;
}

okrsRouter.post('/api/okrs/draft', async (req, res) => {
  try {
    const result = await draftProvider.generateDraft({
      focusArea: req.body?.focusArea,
      timeframe: req.body?.timeframe
    });
    return res.status(200).json({ ok: true, draft: result.draft, metadata: result.metadata });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'draft_generation_failed' });
  }
});

okrsRouter.post('/api/okrs/wizard-draft', async (req, res) => {
  const parsed = parseWizardPayload(req.body);
  if (!parsed.input) return res.status(400).json({ ok: false, error: parsed.error ?? 'invalid_wizard_payload' });

  try {
    const result = await draftProvider.generateWizardDraft(parsed.input);
    return res.status(200).json({ ok: true, draft: result.draft, metadata: result.metadata });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'wizard_draft_generation_failed' });
  }
});

okrsRouter.post('/api/okrs/chat', async (req, res) => {
  const parsed = parseConversationPayload(req.body);
  if (!parsed.input) return res.status(400).json({ ok: false, error: parsed.error ?? 'invalid_chat_payload' });

  try {
    const result = await draftProvider.continueConversation(parsed.input);
    return res.status(200).json({
      ok: true,
      assistantMessage: result.assistantMessage,
      mode: result.mode,
      questions: result.questions ?? [],
      rationale: result.rationale ?? [],
      coachingContext: result.coachingContext ?? {},
      missingContext: result.missingContext ?? [],
      draft: result.draft,
      metadata: result.metadata
    });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'chat_refinement_failed' });
  }
});

okrsRouter.post('/api/okr-drafts/sessions', requireMutatingAuth, async (req, res) => {
  try {
    const actor = await requesterActor(req);
    if (!canManageDrafts(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_create_draft' });
    }

    const title = typeof req.body?.title === 'string' && req.body.title.trim() ? req.body.title.trim() : 'Untitled draft';
    const session = await createDraftSession({ teamId: actor.activeTeamId, ownerUserId: actor.userId, title });
    return res.status(201).json({ ok: true, session });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_create_draft_session' });
  }
});

okrsRouter.get('/api/okr-drafts', requireMutatingAuth, async (req, res) => {
  try {
    const actor = await requesterActor(req);
    const visibleTeams = actor.memberships.some((m) => m.role === 'senior_leader') ? actorTeamIds(actor) : [actor.activeTeamId];
    const drafts = await listDraftSessions(visibleTeams);
    return res.status(200).json({ ok: true, drafts });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_list_drafts' });
  }
});

okrsRouter.get('/api/okr-drafts/:id', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_draft_id' });

  try {
    const actor = await requesterActor(req);
    const draft = await getDraftSessionById(id);
    if (!draft || !canViewTeam(actor, draft.team_id)) {
      return res.status(404).json({ ok: false, error: 'draft_not_found' });
    }

    return res.status(200).json({ ok: true, draft });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_get_draft' });
  }
});

okrsRouter.post('/api/okr-drafts/:id/versions', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_draft_id' });

  const parsed = parseDraftPayload(req.body?.draft);
  if (!parsed.input) return res.status(400).json({ ok: false, error: parsed.error ?? 'invalid_draft_payload' });

  try {
    const actor = await requesterActor(req);
    const draft = await getDraftSessionById(id);
    if (!draft || !canManageDrafts(actor, draft.team_id)) {
      return res.status(403).json({ ok: false, error: 'forbidden_edit_draft' });
    }

    const status = req.body?.status === 'ready' ? 'ready' : 'saved';
    const version = await appendDraftVersion({
      sessionId: id,
      draft: parsed.input,
      metadata: req.body?.metadata,
      source: req.body?.source === 'restore' ? 'restore' : 'manual_save',
      summary: typeof req.body?.summary === 'string' ? req.body.summary : 'Draft saved',
      actorUserId: actor.userId,
      status
    });

    return res.status(201).json({ ok: true, version });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_save_draft' });
  }
});

okrsRouter.post('/api/okr-drafts/:id/chat', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_draft_id' });

  const parsed = parseConversationPayload(req.body);
  if (!parsed.input) return res.status(400).json({ ok: false, error: parsed.error ?? 'invalid_chat_payload' });

  try {
    const actor = await requesterActor(req);
    const draft = await getDraftSessionById(id);
    if (!draft || !canManageDrafts(actor, draft.team_id)) {
      return res.status(403).json({ ok: false, error: 'forbidden_edit_draft' });
    }

    const result = await draftProvider.continueConversation(parsed.input);
    const persisted = await appendDraftVersion({
      sessionId: id,
      draft: result.draft,
      metadata: { ...result.metadata, mode: result.mode, missingContext: result.missingContext ?? [] },
      source: 'chat',
      summary: typeof result.assistantMessage === 'string' ? result.assistantMessage.slice(0, 160) : 'Coach refinement',
      actorUserId: actor.userId,
      status: result.mode === 'questions' ? 'discovery' : 'refining'
    });

    return res.status(200).json({ ok: true, ...result, versionId: persisted.id });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'chat_refinement_failed' });
  }
});

okrsRouter.delete('/api/okr-drafts/:id', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_draft_session_id' });

  try {
    const actor = await requesterActor(req);
    if (!canManageDrafts(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_manage_drafts' });
    }

    const deleted = await deleteDraftSession({ sessionId: id, teamId: actor.activeTeamId, actorUserId: actor.userId });
    if (!deleted) return res.status(404).json({ ok: false, error: 'draft_not_found' });
    return res.status(200).json({ ok: true, deleted: true });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_delete_draft' });
  }
});

okrsRouter.post('/api/okr-drafts/:id/publish', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_draft_id' });

  try {
    const actor = await requesterActor(req);
    const draft = await getDraftSessionById(id);
    if (!draft) return res.status(404).json({ ok: false, error: 'draft_not_found' });
    if (!canPublishOkrs(actor, draft.team_id)) {
      return res.status(403).json({ ok: false, error: 'forbidden_publish_draft' });
    }

    const okr = await publishDraftSession({ sessionId: id, actorUserId: actor.userId, teamId: draft.team_id });
    if (!okr) return res.status(404).json({ ok: false, error: 'draft_not_found' });
    return res.status(200).json({ ok: true, okr });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_publish_draft' });
  }
});

okrsRouter.get('/api/okrs', requireMutatingAuth, async (req, res) => {
  try {
    const actor = await requesterActor(req);
    const okrs = actor.memberships.some((m) => m.role === 'senior_leader')
      ? await listOkrsAcrossTeams(actorTeamIds(actor))
      : await listOkrsForTeam(actor.activeTeamId);
    return res.status(200).json({ ok: true, okrs, activeTeamId: actor.activeTeamId });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_list_okrs' });
  }
});

okrsRouter.get('/api/checkins', requireMutatingAuth, async (req, res) => {
  const limitRaw = req.query?.limit;
  const daysRaw = req.query?.days;
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 100;
  const days = typeof daysRaw === 'string' ? Number(daysRaw) : 30;

  try {
    const actor = await requesterActor(req);
    const visibleTeams = actor.memberships.some((m) => m.role === 'senior_leader') ? actorTeamIds(actor) : [actor.activeTeamId];
    const checkins = await listTeamCheckins(visibleTeams, Number.isFinite(limit) ? limit : 100);
    const cutoffMs = Number.isFinite(days) ? Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000 : null;
    const filtered = cutoffMs == null
      ? checkins
      : checkins.filter((checkin: any) => new Date(checkin.created_at).getTime() >= cutoffMs);
    return res.status(200).json({ ok: true, checkins: filtered });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_list_team_checkins' });
  }
});

okrsRouter.get('/api/manager/digest', requireMutatingAuth, async (req, res) => {
  try {
    const actor = await requesterActor(req);
    if (!canManageOkrs(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_manager_digest' });
    }

    const digest = await listManagerDigest(actor.activeTeamId);
    return res.status(200).json({ ok: true, digest });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_manager_digest' });
  }
});

okrsRouter.get('/api/leader/rollup', requireMutatingAuth, async (req, res) => {
  try {
    const actor = await requesterActor(req);
    if (!actor.memberships.some((m) => m.role === 'senior_leader')) {
      return res.status(403).json({ ok: false, error: 'forbidden_leader_rollup' });
    }

    const rollup = await getLeaderRollup(actorTeamIds(actor));
    return res.status(200).json({ ok: true, rollup });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_leader_rollup' });
  }
});

okrsRouter.post('/api/kr-quality/hints', requireMutatingAuth, async (req, res) => {
  const parsed = parseOkrSetPayload(req.body);
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error });

  try {
    const actor = await requesterActor(req);
    if (!canManageOkrs(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_kr_quality_hints' });
    }

    const hints = parsed.input.objectives.map((objective, objectiveIndex) => ({
      objectiveIndex,
      objectiveHints: objective.objective.trim().split(' ').length < 4 ? ['Objective is too short; add business outcome context.'] : [],
      keyResults: objective.keyResults.map((kr: { title: string; targetValue: number; currentValue: number; unit: string }, keyResultIndex: number) => ({
        keyResultIndex,
        hints: deriveKrQualityHints(kr, objective.timeframe)
      }))
    }));

    return res.status(200).json({ ok: true, hints });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_kr_quality_hints' });
  }
});

okrsRouter.post('/api/okrs', requireMutatingAuth, async (req, res) => {
  const parsed = parseOkrPayload(req.body);
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error });

  try {
    const actor = await requesterActor(req);
    if (!canManageOkrs(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_create_okr' });
    }

    const okr = await createOkr({ ownerUserId: actor.userId, teamId: actor.activeTeamId, ...parsed.input });
    return res.status(201).json({ ok: true, okr });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_create_okr' });
  }
});

okrsRouter.put('/api/okrs/:id', requireMutatingAuth, async (req, res) => {
  const parsed = parseOkrPayload(req.body);
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error });

  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_okr_id' });

  try {
    const actor = await requesterActor(req);
    if (!canManageOkrs(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_edit_okr' });
    }

    const okr = await updateOkr(id, { ownerUserId: actor.userId, teamId: actor.activeTeamId, ...parsed.input });
    if (!okr) return res.status(404).json({ ok: false, error: 'okr_not_found' });
    return res.status(200).json({ ok: true, okr });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_update_okr' });
  }
});

okrsRouter.post('/api/okrs/bulk-upsert', requireMutatingAuth, async (req, res) => {
  const parsed = parseOkrSetPayload(req.body);
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error });

  try {
    const actor = await requesterActor(req);
    if (!canManageOkrs(actor, actor.activeTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_edit_okr' });
    }

    const existing = await listOkrsForTeam(actor.activeTeamId);

    const upserted = [];
    for (let i = 0; i < parsed.input.objectives.length; i += 1) {
      const objective = parsed.input.objectives[i];
      const existingId = existing[i]?.id;
      const saved = existingId
        ? await updateOkr(existingId, { ownerUserId: actor.userId, teamId: actor.activeTeamId, ...objective })
        : await createOkr({ ownerUserId: actor.userId, teamId: actor.activeTeamId, ...objective });
      if (saved) upserted.push(saved);
    }

    return res.status(200).json({ ok: true, okrs: upserted });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_bulk_upsert_okrs' });
  }
});

okrsRouter.get('/api/key-results/:id/checkins', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  const limitRaw = req.query?.limit;
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 10;

  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_key_result_id' });

  try {
    const actor = await requesterActor(req);
    const krTeamId = await getOkrTeamIdByKeyResultId(id);
    if (!krTeamId || !canViewTeam(actor, krTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_view_checkins' });
    }

    const visibleTeams = actor.memberships.some((m) => m.role === 'senior_leader') ? actorTeamIds(actor) : [actor.activeTeamId];
    const checkins = await listKrCheckins(id, visibleTeams, Number.isFinite(limit) ? limit : 10);
    return res.status(200).json({ ok: true, checkins });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_list_checkins' });
  }
});

okrsRouter.post('/api/key-results/:id/checkins', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  const value = Number(req.body?.value);
  const commentary = typeof req.body?.commentary === 'string' ? req.body.commentary : '';
  const note = typeof req.body?.note === 'string' ? req.body.note : commentary;
  const progressDelta = req.body?.progressDelta == null ? null : Number(req.body.progressDelta);
  const confidence = req.body?.confidence == null ? null : Number(req.body.confidence);
  const blockerTags = Array.isArray(req.body?.blockerTags)
    ? req.body.blockerTags.map((tag: any) => String(tag).trim()).filter(Boolean)
    : [];

  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_key_result_id' });
  if (!Number.isFinite(value)) return res.status(400).json({ ok: false, error: 'invalid_value' });
  if (progressDelta != null && !Number.isFinite(progressDelta)) return res.status(400).json({ ok: false, error: 'invalid_progress_delta' });
  if (confidence != null && (!Number.isFinite(confidence) || confidence < 1 || confidence > 5)) {
    return res.status(400).json({ ok: false, error: 'invalid_confidence' });
  }

  try {
    const actor = await requesterActor(req);
    const krTeamId = await getOkrTeamIdByKeyResultId(id);
    if (!krTeamId || !canCheckin(actor, krTeamId)) {
      return res.status(403).json({ ok: false, error: 'forbidden_checkin' });
    }

    const checkin = await addKrCheckin({
      keyResultId: id,
      userId: actor.userId,
      value,
      commentary,
      note,
      progressDelta,
      confidence,
      blockerTags
    });
    return res.status(201).json({ ok: true, checkin });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_add_checkin' });
  }
});

okrsRouter.post('/api/okrs/import/excel/preview', requireMutatingAuth, upload.single('file'), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ ok: false, error: 'file_required' });
  }

  const parsed = parseWorkbook(req.file.buffer);
  if (parsed.fileErrors.length > 0) {
    return res.status(400).json({ ok: false, error: 'invalid_file', fileErrors: parsed.fileErrors });
  }

  const actor = await requesterActor(req);
  const preview = await buildPreview(actor.userId, parsed.rows);
  return res.status(200).json({ ok: true, preview });
});

okrsRouter.post('/api/okrs/import/excel/apply', requireMutatingAuth, upload.single('file'), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ ok: false, error: 'file_required' });
  }

  const parsed = parseWorkbook(req.file.buffer);
  if (parsed.fileErrors.length > 0) {
    return res.status(400).json({ ok: false, error: 'invalid_file', fileErrors: parsed.fileErrors });
  }

  let selectedRowNumbers: number[] | undefined;
  if (Array.isArray(req.body?.selectedRowNumbers)) {
    selectedRowNumbers = req.body.selectedRowNumbers
      .map((v: any) => Number(v))
      .filter((n: number) => Number.isFinite(n));
  } else if (typeof req.body?.selectedRowNumbers === 'string' && req.body.selectedRowNumbers.trim()) {
    selectedRowNumbers = req.body.selectedRowNumbers
      .split(',')
      .map((v: string) => Number(v.trim()))
      .filter((n: number) => Number.isFinite(n));
  }

  const actor = await requesterActor(req);
  const preview = await buildPreview(actor.userId, parsed.rows);
  const result = await applyPreviewSelection({
    userId: actor.userId,
    previewRows: preview.rows,
    selectedRowNumbers
  });

  return res.status(200).json({ ok: true, result, summary: preview.summary });
});
