import { Router } from 'express';
import { WhatsAppReminderService } from '../services/reminders/whatsapp-reminder.service.js';
import { insertMessageEvent, listRecentMessageEvents } from '../data/message-events-repo.js';

export const whatsappSendRouter = Router();

const service = new WhatsAppReminderService();

whatsappSendRouter.get('/api/reminders/whatsapp/events', async (req, res) => {
  const limitRaw = req.query?.limit;
  const limit = typeof limitRaw === 'string' ? Number(limitRaw) : 20;

  try {
    const events = await listRecentMessageEvents(Number.isFinite(limit) ? limit : 20);
    return res.status(200).json({ ok: true, events });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message ?? 'failed_to_list_events' });
  }
});

whatsappSendRouter.post('/api/reminders/whatsapp/send-test', async (req, res) => {
  const to = req.body?.to;
  const message = req.body?.message;

  if (!to || typeof to !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_to' });
  }

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, error: 'missing_message' });
  }

  try {
    const result = await service.sendTest({ to, body: message });

    console.log('[whatsapp.outbound]', {
      provider: 'twilio',
      to,
      sid: result.sid,
      status: result.status
    });

    try {
      await insertMessageEvent({
        provider: 'twilio',
        direction: 'outbound',
        sid: result.sid,
        to,
        status: result.status,
        bodyPreview: message.slice(0, 120)
      });
    } catch (persistError: any) {
      console.error('[whatsapp.outbound.persist.error]', {
        error: persistError?.message ?? 'unknown_error'
      });
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[whatsapp.outbound.error]', {
      to,
      error: error?.message ?? 'unknown_error'
    });

    return res.status(502).json({
      ok: false,
      error: 'send_failed',
      message: error?.message ?? 'Unknown send error'
    });
  }
});
