import { pool } from '../db/pool.js';

export interface KeyResultInput {
  id?: number;
  title: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

export interface OkrInput {
  userId: string;
  objective: string;
  timeframe: string;
  keyResults: KeyResultInput[];
}

export interface UserKeyResult {
  id: number;
  okr_id: number;
  objective: string;
  title: string;
  target_value: number;
  current_value: number;
  unit: string;
}

async function hydrateOkr(okrId: number) {
  const okrRes = await pool.query(
    `SELECT id, user_id, objective, timeframe, created_at, updated_at FROM okrs WHERE id = $1`,
    [okrId]
  );
  if (!okrRes.rowCount) return null;

  const krRes = await pool.query(
    `SELECT id, okr_id, title, target_value, current_value, unit, sort_order, created_at, updated_at
     FROM key_results WHERE okr_id = $1 ORDER BY sort_order ASC, id ASC`,
    [okrId]
  );

  return {
    ...okrRes.rows[0],
    keyResults: krRes.rows.map((r) => ({
      ...r,
      target_value: Number(r.target_value),
      current_value: Number(r.current_value)
    }))
  };
}

export async function listOkrsForUser(userId: string) {
  const res = await pool.query(`SELECT id FROM okrs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`, [userId]);
  const okrs = [];
  for (const row of res.rows) {
    const okr = await hydrateOkr(Number(row.id));
    if (okr) okrs.push(okr);
  }
  return okrs;
}

export async function listKeyResultsForUser(userId: string): Promise<UserKeyResult[]> {
  const res = await pool.query(
    `SELECT kr.id, kr.okr_id, o.objective, kr.title, kr.target_value, kr.current_value, kr.unit
     FROM key_results kr
     JOIN okrs o ON o.id = kr.okr_id
     WHERE o.user_id = $1`,
    [userId]
  );

  return res.rows.map((row) => ({
    ...row,
    id: Number(row.id),
    okr_id: Number(row.okr_id),
    target_value: Number(row.target_value),
    current_value: Number(row.current_value)
  }));
}

export async function createOkr(input: OkrInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const okrRes = await client.query(
      `INSERT INTO okrs (user_id, objective, timeframe) VALUES ($1, $2, $3) RETURNING id`,
      [input.userId, input.objective, input.timeframe]
    );
    const okrId = Number(okrRes.rows[0].id);

    for (const [index, kr] of input.keyResults.entries()) {
      await client.query(
        `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [okrId, kr.title, kr.targetValue, kr.currentValue, kr.unit, index]
      );
    }

    await client.query('COMMIT');
    return await hydrateOkr(okrId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function updateOkr(okrId: number, input: OkrInput) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const updateRes = await client.query(
      `UPDATE okrs SET objective = $2, timeframe = $3, updated_at = NOW() WHERE id = $1 AND user_id = $4`,
      [okrId, input.objective, input.timeframe, input.userId]
    );

    if (!updateRes.rowCount) {
      await client.query('ROLLBACK');
      return null;
    }

    await client.query(`DELETE FROM key_results WHERE okr_id = $1`, [okrId]);

    for (const [index, kr] of input.keyResults.entries()) {
      await client.query(
        `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [okrId, kr.title, kr.targetValue, kr.currentValue, kr.unit, index]
      );
    }

    await client.query('COMMIT');
    return await hydrateOkr(okrId);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function listKrCheckins(keyResultId: number, userId: string, limit = 10) {
  const safeLimit = Math.max(1, Math.min(limit, 50));
  const res = await pool.query(
    `SELECT c.id, c.key_result_id, c.value, c.commentary, c.source, c.created_by_user_id, c.created_at
     FROM kr_checkins c
     JOIN key_results kr ON kr.id = c.key_result_id
     JOIN okrs o ON o.id = kr.okr_id
     WHERE c.key_result_id = $1
       AND o.user_id = $2
     ORDER BY c.created_at DESC, c.id DESC
     LIMIT $3`,
    [keyResultId, userId, safeLimit]
  );

  return res.rows.map((row) => ({
    ...row,
    value: Number(row.value)
  }));
}

export async function addKrCheckin(input: {
  keyResultId: number;
  userId: string;
  value: number;
  commentary?: string;
  source?: string;
  createdAt?: string;
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const checkin = await client.query(
      `INSERT INTO kr_checkins (key_result_id, value, commentary, source, created_by_user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))
       RETURNING id, key_result_id, value, commentary, source, created_by_user_id, created_at`,
      [input.keyResultId, input.value, input.commentary ?? null, input.source ?? 'manual', input.userId, input.createdAt ?? null]
    );

    await client.query(`UPDATE key_results SET current_value = $2, updated_at = NOW() WHERE id = $1`, [
      input.keyResultId,
      input.value
    ]);

    await client.query('COMMIT');
    return checkin.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
