import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: env.databaseUrl });

export type ReminderStatus = 'pending' | 'processing' | 'sent' | 'failed';

export interface ReminderRecord {
  id: number;
  recipient: string;
  message: string;
  due_at: string;
  status: ReminderStatus;
}

export async function ensureRemindersTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id BIGSERIAL PRIMARY KEY,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      due_at TIMESTAMPTZ NOT NULL,
      recipient TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sent_at TIMESTAMPTZ,
      last_error TEXT
    );
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_reminders_due_status ON reminders(status, due_at);`);
}

export async function createReminder(input: {
  recipient: string;
  message: string;
  dueAtIso: string;
}): Promise<{ id: number }> {
  const result = await pool.query(
    `
    INSERT INTO reminders (recipient, message, due_at, status)
    VALUES ($1, $2, $3::timestamptz, 'pending')
    RETURNING id
    `,
    [input.recipient, input.message, input.dueAtIso]
  );

  return { id: Number(result.rows[0].id) };
}

export async function listRecentReminders(limit = 20): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await pool.query(
    `
    SELECT id, created_at, due_at, recipient, message, status, sent_at, last_error
    FROM reminders
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );
  return result.rows;
}

export async function claimDueReminders(limit = 10): Promise<ReminderRecord[]> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `
      WITH due AS (
        SELECT id
        FROM reminders
        WHERE status = 'pending'
          AND due_at <= NOW()
        ORDER BY due_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE reminders r
      SET status = 'processing'
      FROM due
      WHERE r.id = due.id
      RETURNING r.id, r.recipient, r.message, r.due_at, r.status
      `,
      [limit]
    );
    await client.query('COMMIT');
    return result.rows as ReminderRecord[];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function markReminderSent(id: number): Promise<void> {
  await pool.query(
    `
    UPDATE reminders
    SET status = 'sent', sent_at = NOW(), last_error = NULL
    WHERE id = $1
    `,
    [id]
  );
}

export async function markReminderFailed(id: number, lastError: string): Promise<void> {
  await pool.query(
    `
    UPDATE reminders
    SET status = 'failed', last_error = $2
    WHERE id = $1
    `,
    [id, lastError.slice(0, 500)]
  );
}
