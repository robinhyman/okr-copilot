import { env } from '../../config/env.js';

export interface ReminderPayload {
  workspaceId: string;
  recipient: string;
  message: string;
  dueAtIso: string;
}

export interface SendWhatsAppInput {
  to: string;
  body: string;
}

export class WhatsAppReminderService {
  // TODO-B3: enqueue scheduled reminders via queue/worker instead of immediate send.
  async scheduleReminder(payload: ReminderPayload): Promise<{ accepted: boolean; reason: string }> {
    return {
      accepted: false,
      reason: `Placeholder only. Would enqueue WhatsApp reminder for ${payload.recipient} at ${payload.dueAtIso}.`
    };
  }

  async sendTest(input: SendWhatsAppInput): Promise<{ sid: string; status: string | null }> {
    if (env.whatsappProvider !== 'twilio') {
      throw new Error(`Unsupported WhatsApp provider: ${env.whatsappProvider}`);
    }

    if (!env.twilioAccountSid || !env.twilioAuthToken) {
      throw new Error('Missing Twilio credentials in environment');
    }

    const params = new URLSearchParams({
      From: env.twilioWhatsAppFrom,
      To: input.to,
      Body: input.body
    });

    // Use account/sandbox-level status callback configuration for now.
    // TODO-B3: allow per-message callback override once URL management is centralized.

    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${env.twilioAccountSid}/Messages.json`;
    const auth = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`Twilio send failed: non-JSON response (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(`Twilio send failed (${response.status}): ${json?.message ?? 'unknown error'}`);
    }

    return {
      sid: json.sid,
      status: json.status ?? null
    };
  }
}
