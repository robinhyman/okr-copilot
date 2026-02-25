import { pool } from '../db/pool.js';

export type ReminderStatus = 'pending' | 'processing' | 'retry_scheduled' | 'sent' | 'failed';

export interface ReminderRecord {
  id: number;
  recipient: string;
  message: string;
  due_at: string;
  status: ReminderStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
}

const RETRY_BACKOFF_MINUTES = [1, 5, 15] as const;

function backoffMinutesForAttempt(attemptCount: number): number | null {
  // attemptCount is 1-based, after incrementing on a failed attempt.
  return RETRY_BACKOFF_MINUTES[attemptCount - 1] ?? null;
}

export async function createReminder(input: {
  recipient: string;
  message: string;
  dueAtIso: string;
}): Promise<{ id: number }> {
  const result = await pool.query(
    `
    INSERT INTO reminders (recipient, message, due_at, next_attempt_at, status)
    VALUES ($1, $2, $3::timestamptz, $3::timestamptz, 'pending')
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
    SELECT id, created_at, due_at, recipient, message, status, sent_at, last_error,
           last_error AS failure_reason,
           attempt_count, max_attempts, next_attempt_at, last_attempt_at, outbound_sid,
           provider_status, failure_terminal_at
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
        WHERE status IN ('pending', 'retry_scheduled')
          AND next_attempt_at <= NOW()
          AND attempt_count < max_attempts
        ORDER BY next_attempt_at ASC, due_at ASC, id ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE reminders r
      SET status = 'processing',
          last_attempt_at = NOW()
      FROM due
      WHERE r.id = due.id
      RETURNING r.id, r.recipient, r.message, r.due_at, r.status,
                r.attempt_count, r.max_attempts, r.next_attempt_at, r.last_attempt_at
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

export async function markReminderSent(id: number, outboundSid: string): Promise<void> {
  await pool.query(
    `
    UPDATE reminders
    SET status = 'sent',
        sent_at = NOW(),
        outbound_sid = $2,
        provider_status = 'queued',
        last_error = NULL,
        next_attempt_at = NULL
    WHERE id = $1
    `,
    [id, outboundSid]
  );
}

export async function markReminderAttemptFailed(id: number, lastError: string): Promise<void> {
  const result = await pool.query(
    `
    SELECT attempt_count, max_attempts
    FROM reminders
    WHERE id = $1
    `,
    [id]
  );

  if (!result.rowCount) return;

  const currentAttempts = Number(result.rows[0].attempt_count ?? 0);
  const maxAttempts = Number(result.rows[0].max_attempts ?? 4);
  const nextAttemptCount = currentAttempts + 1;
  const nextBackoffMinutes = backoffMinutesForAttempt(nextAttemptCount);

  if (nextAttemptCount >= maxAttempts || nextBackoffMinutes === null) {
    await pool.query(
      `
      UPDATE reminders
      SET status = 'failed',
          attempt_count = $2,
          last_error = $3,
          provider_status = 'failed_terminal',
          failure_terminal_at = NOW(),
          next_attempt_at = NULL
      WHERE id = $1
      `,
      [id, nextAttemptCount, lastError.slice(0, 500)]
    );
    return;
  }

  await pool.query(
    `
    UPDATE reminders
    SET status = 'retry_scheduled',
        attempt_count = $2,
        last_error = $3,
        provider_status = 'retry_scheduled',
        next_attempt_at = NOW() + ($4::text || ' minutes')::interval
    WHERE id = $1
    `,
    [id, nextAttemptCount, lastError.slice(0, 500), String(nextBackoffMinutes)]
  );
}

export async function applyReminderStatusBySid(input: {
  sid: string;
  providerStatus: string;
  providerErrorCode?: string | null;
}): Promise<{ updated: boolean; duplicate: boolean }> {
  const status = input.providerStatus.toLowerCase().trim();

  const result = await pool.query(
    `
    UPDATE reminders
    SET provider_status = $2,
        last_error = CASE
          WHEN $3::text IS NOT NULL AND $3::text <> '' THEN COALESCE(last_error, '') || CASE WHEN last_error IS NULL OR last_error = '' THEN '' ELSE '; ' END || 'provider_error:' || $3::text
          ELSE last_error
        END,
        failure_terminal_at = CASE
          WHEN $2 IN ('undelivered', 'failed') THEN NOW()
          ELSE failure_terminal_at
        END,
        status = CASE
          WHEN $2 IN ('delivered', 'read') THEN 'sent'
          WHEN $2 IN ('undelivered', 'failed') AND status <> 'sent' THEN 'failed'
          ELSE status
        END
    WHERE outbound_sid = $1
      AND (provider_status IS DISTINCT FROM $2)
    `,
    [input.sid, status, input.providerErrorCode ?? null]
  );

  if (result.rowCount && result.rowCount > 0) {
    return { updated: true, duplicate: false };
  }

  const existing = await pool.query(`SELECT id FROM reminders WHERE outbound_sid = $1`, [input.sid]);
  if (!existing.rowCount) {
    return { updated: false, duplicate: false };
  }

  return { updated: false, duplicate: true };
}

export async function requeueFailedReminder(id: number): Promise<{ updated: boolean; reminder: any | null }> {
  const result = await pool.query(
    `
    UPDATE reminders
    SET status = 'pending',
        attempt_count = 0,
        next_attempt_at = NOW(),
        last_attempt_at = NULL,
        provider_status = 'requeued',
        failure_terminal_at = NULL,
        last_error = NULL,
        outbound_sid = NULL,
        sent_at = NULL
    WHERE id = $1
      AND status = 'failed'
    RETURNING id
    `,
    [id]
  );

  if (!result.rowCount) {
    const existing = await getReminderById(id);
    return { updated: false, reminder: existing };
  }

  const reminder = await getReminderById(id);
  return { updated: true, reminder };
}

export async function getReminderById(id: number): Promise<any | null> {
  const result = await pool.query(
    `
    SELECT id, created_at, due_at, recipient, message, status, sent_at, last_error,
           last_error AS failure_reason,
           attempt_count, max_attempts, next_attempt_at, last_attempt_at, outbound_sid,
           provider_status, failure_terminal_at
    FROM reminders
    WHERE id = $1
    `,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function __dangerousTruncateRemindersForTests(): Promise<void> {
  await pool.query('TRUNCATE TABLE reminders RESTART IDENTITY');
}
