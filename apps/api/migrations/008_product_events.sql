CREATE TABLE IF NOT EXISTS product_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_name TEXT NOT NULL,
  experiment_id TEXT,
  variant TEXT,
  user_id TEXT,
  persona TEXT,
  team_id TEXT,
  session_id TEXT,
  draft_session_id BIGINT,
  request_id TEXT,
  app_version TEXT,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_product_events_created_at ON product_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_events_event_name ON product_events (event_name);
CREATE INDEX IF NOT EXISTS idx_product_events_experiment ON product_events (experiment_id);
CREATE INDEX IF NOT EXISTS idx_product_events_request_id ON product_events (request_id);
