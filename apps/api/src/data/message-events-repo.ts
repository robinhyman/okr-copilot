import { pool } from '../db/pool.js';

export type MessageEventDirection = 'inbound' | 'outbound' | 'status';

export interface MessageEventInput {
  provider: 'twilio';
  direction: MessageEventDirection;
  sid?: string | null;
  from?: string | null;
  to?: string | null;
  status?: string | null;
  bodyPreview?: string | null;
  payloadSummary?: Record<string, unknown>;
}

export async function ensureMessageEventsTable(): Promise<void> {
  // Legacy compatibility only. Schema is now managed via SQL migrations.
}

export async function insertMessageEvent(event: MessageEventInput): Promise<void> {
  await pool.query(
    `
    INSERT INTO message_events
      (provider, direction, sid, sender, recipient, status, body_preview, payload_summary)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
    `,
    [
      event.provider,
      event.direction,
      event.sid ?? null,
      event.from ?? null,
      event.to ?? null,
      event.status ?? null,
      event.bodyPreview ?? null,
      JSON.stringify(event.payloadSummary ?? {})
    ]
  );
}

export async function listRecentMessageEvents(limit = 20): Promise<any[]> {
  const safeLimit = Math.max(1, Math.min(limit, 100));
  const result = await pool.query(
    `
    SELECT id, created_at, provider, direction, sid, sender, recipient, status, body_preview, payload_summary
    FROM message_events
    ORDER BY created_at DESC
    LIMIT $1
    `,
    [safeLimit]
  );
  return result.rows;
}
