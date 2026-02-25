import { Router } from 'express';
import { moduleBoundaries } from '../modules/index.js';

export const modulesRouter = Router();

modulesRouter.get('/modules', (_req, res) => {
  res.json({ modules: moduleBoundaries });
});
