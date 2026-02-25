import { Router } from 'express';
import { createReminder, listRecentReminders } from '../data/reminders-repo.js';
import { runDueReminderCycle } from '../services/reminders/reminder-worker.js';
import { requireMutatingAuth } from '../middleware/auth-guard.js';

export const remindersRouter = Router();

function isValidIsoDate(value: string): boolean {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

remindersRouter.get('/api/reminders', async (req, res) => {
  const limitRaw = req.query?.limit;
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 20;

  try {
    const reminders = await listRecentReminders(Number.isFinite(limit) ? limit : 20);
    return res.status(200).json({ ok: true, reminders });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_list_reminders' });
  }
});

remindersRouter.post('/api/reminders', requireMutatingAuth, async (req, res) => {
  const recipient = req.body?.recipient;
  const message = req.body?.message;
  const dueAtIso = req.body?.dueAtIso;

  if (!recipient || typeof recipient !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_recipient' });
  }
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_message' });
  }
  if (!dueAtIso || typeof dueAtIso !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_dueAtIso' });
  }
  if (!isValidIsoDate(dueAtIso)) {
    return res.status(400).json({ ok: false, error: 'invalid_dueAtIso' });
  }

  try {
    const created = await createReminder({ recipient, message, dueAtIso });
    return res.status(201).json({ ok: true, id: created.id });
  } catch (error: any) {
    if (error?.code === '22007') {
      return res.status(400).json({ ok: false, error: 'invalid_dueAtIso' });
    }
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_create_reminder' });
  }
});

remindersRouter.post('/api/reminders/run-due', requireMutatingAuth, async (_req, res) => {
  try {
    const result = await runDueReminderCycle(10);
    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_run_due' });
  }
});
