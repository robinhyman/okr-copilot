import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { modulesRouter } from './routes/modules.js';
import { defaultsRouter } from './routes/defaults.js';
import { authRouter } from './routes/auth.js';
import { authStubMiddleware } from './modules/auth/auth-middleware.js';
import { SingleUserAuthStubProvider } from './modules/auth/auth-service.js';
import { whatsappWebhooksRouter } from './routes/whatsapp-webhooks.js';
import { whatsappSendRouter } from './routes/whatsapp-send.js';
import { remindersRouter } from './routes/reminders.js';
import { ensureMessageEventsTable } from './data/message-events-repo.js';
import { ensureRemindersTable } from './data/reminders-repo.js';
import { runDueReminderCycle } from './services/reminders/reminder-worker.js';

const app = express();

const authProvider = new SingleUserAuthStubProvider(env.authStubEnabled, {
  id: 'single-user',
  email: env.authStubEmail,
  displayName: env.authStubDisplayName
});

app.use(cors({ origin: env.corsOrigin }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(authStubMiddleware(authProvider));

app.get('/', (_req, res) => {
  res.json({
    name: 'okr-copilot-api',
    status: 'running',
    docs: [
      'GET /health',
      'GET /modules',
      'GET /defaults/checkins',
      'GET /auth/status',
      'POST /api/reminders/whatsapp/inbound',
      'POST /api/reminders/whatsapp/status',
      'POST /api/reminders/whatsapp/send-test',
      'GET /api/reminders/whatsapp/events?limit=20',
      'POST /api/reminders',
      'GET /api/reminders?limit=20',
      'POST /api/reminders/run-due'
    ]
  });
});

app.use(healthRouter);
app.use(modulesRouter);
app.use(defaultsRouter);
app.use(authRouter);
app.use(whatsappWebhooksRouter);
app.use(whatsappSendRouter);
app.use(remindersRouter);

async function start() {
  await ensureMessageEventsTable();
  await ensureRemindersTable();

  app.listen(env.apiPort, () => {
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
