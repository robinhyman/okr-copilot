CREATE TABLE IF NOT EXISTS experiment_assignments (
  id BIGSERIAL PRIMARY KEY,
  experiment_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('wizard_first', 'conversational_first', 'not_enrolled')),
  assignment_source TEXT NOT NULL DEFAULT 'hash_v1',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_exposed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (experiment_key, user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_experiment_assignments_lookup
  ON experiment_assignments (experiment_key, team_id, user_id);
