import { claimDueReminders, markReminderAttemptFailed, markReminderSent } from '../../data/reminders-repo.js';
import { WhatsAppReminderService } from './whatsapp-reminder.service.js';

const service = new WhatsAppReminderService();

export interface ReminderSender {
  sendTest(input: { to: string; body: string }): Promise<{ sid: string; status: string | null }>;
}

export async function runDueReminderCycle(
  limit = 10,
  sender: ReminderSender = service
): Promise<{ processed: number; sent: number; failed: number }> {
  const due = await claimDueReminders(limit);
  let sent = 0;
  let failed = 0;

  for (const reminder of due) {
    try {
      const result = await sender.sendTest({
        to: reminder.recipient,
        body: reminder.message
      });

      console.log('[reminder.sent]', {
        reminderId: reminder.id,
        sid: result.sid,
        status: result.status,
        to: reminder.recipient
      });
      await markReminderSent(reminder.id, result.sid);
      sent += 1;
    } catch (error: any) {
      const message = error?.message ?? 'unknown_error';
      console.error('[reminder.send.error]', { reminderId: reminder.id, error: message });
      await markReminderAttemptFailed(reminder.id, message);
      failed += 1;
    }
  }

  return { processed: due.length, sent, failed };
}
