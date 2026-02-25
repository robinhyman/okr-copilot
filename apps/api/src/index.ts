import { env, validateStartupConfig } from './config/env.js';
import { runDueReminderCycle } from './services/reminders/reminder-worker.js';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';

const app = createApp();

async function start() {
  validateStartupConfig();
  const migrationResult = await runMigrations();

  app.listen(env.apiPort, () => {
    console.log('[migrations.applied]', migrationResult.applied);
    console.log(`OKR Co-Pilot API listening on http://localhost:${env.apiPort}`);
    console.log('[startup.config]', {
      cwd: process.cwd(),
      twilioVerifySignature: env.twilioVerifySignature,
      reminderWorkerEnabled: env.reminderWorkerEnabled,
      reminderTickSeconds: env.reminderTickSeconds
    });
  });

  if (env.reminderWorkerEnabled) {
    const tickMs = Math.max(5, env.reminderTickSeconds) * 1000;
    setInterval(async () => {
      try {
        const result = await runDueReminderCycle(10);
        if (result.processed > 0) {
          console.log('[reminder.worker.tick]', result);
        }
      } catch (error: any) {
        console.error('[reminder.worker.error]', { error: error?.message ?? 'unknown_error' });
      }
    }, tickMs);
  }
}

start().catch((error) => {
  console.error('[startup.error]', error);
  process.exit(1);
});
