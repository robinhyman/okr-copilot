import express from 'express';
import cors from 'cors';
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

const isPrivateLanHost = (host: string): boolean => {
  if (/^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  return false;
};

const isAllowedOrigin = (origin: string): boolean => {
  if (env.corsOrigins.includes(origin)) return true;

  if (env.nodeEnv !== 'development') return false;

  try {
    const parsed = new URL(origin);
    return parsed.protocol.startsWith('http') && parsed.port === '5173' && isPrivateLanHost(parsed.hostname);
  } catch {
    return false;
  }
};

export function createApp() {
  const app = express();

  const authProvider = new SingleUserAuthStubProvider(env.authStubEnabled, {
    id: 'single-user',
    email: env.authStubEmail,
    displayName: env.authStubDisplayName
  });

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
      }
    })
  );
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(authStubMiddleware(authProvider));

  app.get('/', (_req, res) => {
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

  return app;
}
