import { pool } from '../db/pool.js';

export interface ProductEventInput {
  event_name: string;
  experiment_id?: string;
  variant?: string;
  user_id?: string;
  persona?: string;
  team_id?: string;
  session_id?: string;
  draft_session_id?: number;
  request_id?: string;
  app_version?: string;
  [key: string]: unknown;
}

const RESERVED_KEYS = new Set([
  'event_name',
  'experiment_id',
  'variant',
  'user_id',
  'persona',
  'team_id',
  'session_id',
  'draft_session_id',
  'request_id',
  'app_version'
]);

function splitPayload(event: ProductEventInput) {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!RESERVED_KEYS.has(key)) payload[key] = value;
  }
  return payload;
}

export async function insertProductEvents(events: ProductEventInput[]): Promise<number> {
  if (!events.length) return 0;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const event of events) {
      await client.query(
        `INSERT INTO product_events
          (event_name, experiment_id, variant, user_id, persona, team_id, session_id, draft_session_id, request_id, app_version, payload_json)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb)`,
        [
          event.event_name,
          event.experiment_id ?? null,
          event.variant ?? null,
          event.user_id ?? null,
          event.persona ?? null,
          event.team_id ?? null,
          event.session_id ?? null,
          Number.isFinite(Number(event.draft_session_id)) ? Number(event.draft_session_id) : null,
          event.request_id ?? null,
          event.app_version ?? null,
          JSON.stringify(splitPayload(event))
        ]
      );
    }
    await client.query('COMMIT');
    return events.length;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
