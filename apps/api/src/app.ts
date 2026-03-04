import express from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';
import { readyRouter } from './routes/ready.js';
import { modulesRouter } from './routes/modules.js';
import { defaultsRouter } from './routes/defaults.js';
import { authRouter } from './routes/auth.js';
import { authStubMiddleware } from './modules/auth/auth-middleware.js';
import { SingleUserAuthStubProvider } from './modules/auth/auth-service.js';
import { whatsappWebhooksRouter } from './routes/whatsapp-webhooks.js';
import { whatsappSendRouter } from './routes/whatsapp-send.js';
import { remindersRouter } from './routes/reminders.js';
import { okrsRouter } from './routes/okrs.js';

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

  app.get('/api', (_req, res) => {
    res.json({
      name: 'okr-copilot-api',
      status: 'running',
      docs: [
        'GET /health',
        'GET /ready',
        'GET /modules',
        'GET /defaults/checkins',
        'GET /auth/status',
        'POST /api/reminders/whatsapp/inbound',
        'POST /api/reminders/whatsapp/status',
        'POST /api/reminders/whatsapp/send-test',
        'GET /api/reminders/whatsapp/events?limit=20',
        'POST /api/reminders',
        'GET /api/reminders?limit=20',
        'POST /api/reminders/:id/requeue',
        'POST /api/reminders/run-due',
        'POST /api/okrs/draft',
        'GET /api/okrs',
        'POST /api/okrs',
        'PUT /api/okrs/:id',
        'GET /api/key-results/:id/checkins?limit=10',
        'POST /api/key-results/:id/checkins',
        'POST /api/okrs/import/excel/preview (multipart form-data: file)',
        'POST /api/okrs/import/excel/apply (multipart form-data: file, optional selectedRowNumbers=2,3)'
      ]
    });
  });

  app.use(healthRouter);
  app.use(readyRouter);
  app.use(modulesRouter);
  app.use(defaultsRouter);
  app.use(authRouter);
  app.use(whatsappWebhooksRouter);
  app.use(whatsappSendRouter);
  app.use(remindersRouter);
  app.use(okrsRouter);

  if (env.serveWebDist) {
    const webDistDir = path.resolve(process.cwd(), env.webDistDir);
    const webIndexPath = path.join(webDistDir, 'index.html');

    if (!fs.existsSync(webIndexPath)) {
      throw new Error(`[config.invalid] WEB_DIST_DIR is missing index.html: ${webIndexPath}`);
    }

    app.use(express.static(webDistDir));
    app.get(/^(?!\/api|\/health|\/ready|\/modules|\/defaults|\/auth).*/, (_req, res) => {
      res.sendFile(webIndexPath);
    });
  } else {
    app.get('/', (_req, res) => {
      res.redirect('/api');
    });
  }

  return app;
}
