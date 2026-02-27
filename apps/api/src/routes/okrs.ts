import { Router } from 'express';
import multer from 'multer';
import { requireMutatingAuth } from '../middleware/auth-guard.js';
import { addKrCheckin, createOkr, listKrCheckins, listOkrsForUser, updateOkr } from '../data/okrs-repo.js';
import { createOkrDraftProvider, type OkrConversationMessage } from '../services/ai/okr-draft-provider.js';
import { applyPreviewSelection, buildPreview, parseWorkbook } from '../services/excel/kr-import.js';

export const okrsRouter = Router();
const draftProvider = createOkrDraftProvider();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

function requesterUserId(req: any): string {
  return req.auth?.user?.id ?? 'single-user';
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

function parseOkrPayload(body: any) {
  if (!body || typeof body.objective !== 'string' || typeof body.timeframe !== 'string') {
    return { error: 'invalid_okr_payload' as const };
  }

  const keyResults = Array.isArray(body.keyResults) ? body.keyResults : [];
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

okrsRouter.get('/api/okrs', requireMutatingAuth, async (req, res) => {
  try {
    const okrs = await listOkrsForUser(requesterUserId(req));
    return res.status(200).json({ ok: true, okrs });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_list_okrs' });
  }
});

okrsRouter.post('/api/okrs', requireMutatingAuth, async (req, res) => {
  const parsed = parseOkrPayload(req.body);
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error });

  try {
    const okr = await createOkr({ userId: requesterUserId(req), ...parsed.input });
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
    const okr = await updateOkr(id, { userId: requesterUserId(req), ...parsed.input });
    if (!okr) return res.status(404).json({ ok: false, error: 'okr_not_found' });
    return res.status(200).json({ ok: true, okr });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_update_okr' });
  }
});

okrsRouter.get('/api/key-results/:id/checkins', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  const limitRaw = req.query?.limit;
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 10;

  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_key_result_id' });

  try {
    const checkins = await listKrCheckins(id, requesterUserId(req), Number.isFinite(limit) ? limit : 10);
    return res.status(200).json({ ok: true, checkins });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_list_checkins' });
  }
});

okrsRouter.post('/api/key-results/:id/checkins', requireMutatingAuth, async (req, res) => {
  const id = Number(req.params.id);
  const value = Number(req.body?.value);
  const commentary = typeof req.body?.commentary === 'string' ? req.body.commentary : '';

  if (!Number.isFinite(id)) return res.status(400).json({ ok: false, error: 'invalid_key_result_id' });
  if (!Number.isFinite(value)) return res.status(400).json({ ok: false, error: 'invalid_value' });

  try {
    const checkin = await addKrCheckin({
      keyResultId: id,
      userId: requesterUserId(req),
      value,
      commentary
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

  const preview = await buildPreview(requesterUserId(req), parsed.rows);
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

  const preview = await buildPreview(requesterUserId(req), parsed.rows);
  const result = await applyPreviewSelection({
    userId: requesterUserId(req),
    previewRows: preview.rows,
    selectedRowNumbers
  });

  return res.status(200).json({ ok: true, result, summary: preview.summary });
});
