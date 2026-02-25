import { Router } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { insertMessageEvent } from '../data/message-events-repo.js';

export const whatsappWebhooksRouter = Router();

function computeTwilioSignature(url: string, params: Record<string, unknown>, authToken: string): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    const value = params[key];
    data += key + String(value ?? '');
  }
  return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}

function isValidTwilioSignature(req: any): boolean {
  if (!env.twilioVerifySignature) return true;

  const signature = req.header('x-twilio-signature');
  if (!signature) return false;

  // For Twilio, use public webhook URL and posted form fields.
  const forwardedProto = req.header('x-forwarded-proto');
  const host = req.header('host');
  const protocol = forwardedProto ?? req.protocol ?? 'https';
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;
  const params = req.body && typeof req.body === 'object' ? req.body : {};

  const expected = computeTwilioSignature(fullUrl, params, env.twilioAuthToken);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

whatsappWebhooksRouter.post('/api/reminders/whatsapp/inbound', async (req, res) => {
  console.log('[whatsapp.inbound.attempt]', {
    hasSignature: Boolean(req.header('x-twilio-signature')),
    path: req.path,
    verifySignature: env.twilioVerifySignature
  });

  if (!isValidTwilioSignature(req)) {
    console.log('[whatsapp.inbound.reject]', { reason: 'invalid_twilio_signature' });
    return res.status(403).json({ ok: false, error: 'invalid_twilio_signature' });
  }

  const from = req.body?.From;
  const body = req.body?.Body;
  const messageSid = req.body?.MessageSid;

  const bodyPreview = typeof body === 'string' ? body.slice(0, 120) : '';

  console.log('[whatsapp.inbound]', {
    provider: 'twilio',
    from,
    messageSid,
    bodyPreview
  });

  try {
    await insertMessageEvent({
      provider: 'twilio',
      direction: 'inbound',
      sid: messageSid,
      from,
      bodyPreview,
      payloadSummary: {
        numMedia: req.body?.NumMedia,
        profileName: req.body?.ProfileName
      }
    });
  } catch (error: any) {
    console.error('[whatsapp.inbound.persist.error]', { error: error?.message ?? 'unknown_error' });
  }

  // Twilio expects TwiML/XML for inbound webhook responses; empty response is fine.
  res.set('Content-Type', 'text/xml');
  return res.status(200).send('<Response></Response>');
});

whatsappWebhooksRouter.post('/api/reminders/whatsapp/status', async (req, res) => {
  console.log('[whatsapp.status.attempt]', {
    hasSignature: Boolean(req.header('x-twilio-signature')),
    path: req.path
  });

  if (!isValidTwilioSignature(req)) {
    console.log('[whatsapp.status.reject]', { reason: 'invalid_twilio_signature' });
    return res.status(403).json({ ok: false, error: 'invalid_twilio_signature' });
  }

  const messageSid = req.body?.MessageSid;
  const messageStatus = req.body?.MessageStatus;
  const to = req.body?.To;
  const errorCode = req.body?.ErrorCode;

  console.log('[whatsapp.status]', {
    provider: 'twilio',
    messageSid,
    messageStatus,
    to,
    errorCode
  });

  try {
    await insertMessageEvent({
      provider: 'twilio',
      direction: 'status',
      sid: messageSid,
      to,
      status: messageStatus,
      payloadSummary: {
        errorCode,
        channelStatusMessage: req.body?.ChannelStatusMessage,
        eventType: req.body?.EventType
      }
    });
  } catch (error: any) {
    console.error('[whatsapp.status.persist.error]', { error: error?.message ?? 'unknown_error' });
  }

  return res.status(200).json({ ok: true });
});
