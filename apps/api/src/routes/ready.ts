import { Router } from 'express';
import { pool } from '../db/pool.js';

export const readyRouter = Router();

async function checkDatabase(): Promise<boolean> {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

readyRouter.get('/ready', async (_req, res) => {
  const dbOk = await checkDatabase();
  if (!dbOk) {
    return res.status(503).json({ ok: false, ready: false, dependencies: { postgres: false } });
  }

  return res.status(200).json({ ok: true, ready: true, dependencies: { postgres: true } });
});
