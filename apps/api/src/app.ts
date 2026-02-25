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

export function createApp() {
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

  return app;
}
