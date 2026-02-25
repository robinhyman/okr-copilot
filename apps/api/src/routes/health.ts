import { Router } from 'express';
import { env } from '../config/env.js';

export const healthRouter = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'okr-copilot-api',
    deterministicCore: true,
    llmRequired: false,
    dataResidency: env.dataResidency,
    dependencies: {
      postgres: env.databaseUrl,
      redis: env.redisUrl
    },
    timestamp: new Date().toISOString()
  });
});
