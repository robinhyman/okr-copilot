CREATE TABLE IF NOT EXISTS okrs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  objective TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okrs_user_created ON okrs(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS key_results (
  id BIGSERIAL PRIMARY KEY,
  okr_id BIGINT NOT NULL REFERENCES okrs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_value NUMERIC NOT NULL,
  current_value NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'points',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_key_results_okr ON key_results(okr_id, sort_order, id);

CREATE TABLE IF NOT EXISTS kr_checkins (
  id BIGSERIAL PRIMARY KEY,
  key_result_id BIGINT NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  value NUMERIC NOT NULL,
  commentary TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kr_checkins_kr_created ON kr_checkins(key_result_id, created_at DESC);
