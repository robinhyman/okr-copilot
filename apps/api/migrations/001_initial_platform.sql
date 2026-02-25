CREATE TABLE IF NOT EXISTS message_events (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL,
  direction TEXT NOT NULL,
  sid TEXT,
  sender TEXT,
  recipient TEXT,
  status TEXT,
  body_preview TEXT,
  payload_summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_message_events_created_at ON message_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_events_sid ON message_events(sid);

CREATE TABLE IF NOT EXISTS reminders (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at TIMESTAMPTZ NOT NULL,
  recipient TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  last_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 4,
  next_attempt_at TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ,
  outbound_sid TEXT,
  provider_status TEXT,
  failure_terminal_at TIMESTAMPTZ,
  CONSTRAINT reminders_status_check CHECK (status IN ('pending', 'processing', 'retry_scheduled', 'sent', 'failed'))
);

UPDATE reminders SET next_attempt_at = due_at WHERE next_attempt_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminders_due_status ON reminders(status, due_at);
CREATE INDEX IF NOT EXISTS idx_reminders_next_attempt ON reminders(status, next_attempt_at, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_outbound_sid_unique ON reminders(outbound_sid) WHERE outbound_sid IS NOT NULL;
