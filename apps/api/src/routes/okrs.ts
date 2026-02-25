import { Router } from 'express';
import { requireMutatingAuth } from '../middleware/auth-guard.js';
import { addKrCheckin, createOkr, listKrCheckins, listOkrsForUser, updateOkr } from '../data/okrs-repo.js';
import { createOkrDraftProvider } from '../services/ai/okr-draft-provider.js';

export const okrsRouter = Router();
const draftProvider = createOkrDraftProvider();

function requesterUserId(req: any): string {
  return req.auth?.user?.id ?? 'single-user';
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
