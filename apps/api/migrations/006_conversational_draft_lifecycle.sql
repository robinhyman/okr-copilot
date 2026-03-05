CREATE TABLE IF NOT EXISTS okr_draft_sessions (
  id BIGSERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  title TEXT NOT NULL DEFAULT 'Untitled draft',
  status TEXT NOT NULL DEFAULT 'discovery' CHECK (status IN ('discovery', 'refining', 'saved', 'ready', 'published')),
  current_version_id BIGINT,
  published_okr_id BIGINT REFERENCES okrs(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  published_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS okr_draft_versions (
  id BIGSERIAL PRIMARY KEY,
  draft_session_id BIGINT NOT NULL REFERENCES okr_draft_sessions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('chat', 'manual_save', 'restore', 'system')),
  summary TEXT,
  draft_json JSONB NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draft_session_id, version_number)
);

CREATE TABLE IF NOT EXISTS okr_draft_audit_events (
  id BIGSERIAL PRIMARY KEY,
  draft_session_id BIGINT NOT NULL REFERENCES okr_draft_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_okr_draft_sessions_team_updated ON okr_draft_sessions(team_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_okr_draft_versions_session_version ON okr_draft_versions(draft_session_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_okr_draft_audit_events_session_created ON okr_draft_audit_events(draft_session_id, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'okr_draft_sessions' AND constraint_name = 'fk_okr_draft_sessions_current_version'
  ) THEN
    ALTER TABLE okr_draft_sessions
      ADD CONSTRAINT fk_okr_draft_sessions_current_version
      FOREIGN KEY (current_version_id) REFERENCES okr_draft_versions(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Demo draft sessions across teams.
INSERT INTO okr_draft_sessions (team_id, owner_user_id, title, status)
SELECT s.team_id, s.owner_user_id, s.title, s.status
FROM (VALUES
  ('team_product', 'mgr_product', 'Q3 reliability uplift draft', 'saved'),
  ('team_sales', 'mgr_sales', 'Q3 pipeline quality draft', 'refining'),
  ('team_ops', 'mgr_ops', 'Q3 support turnaround draft', 'ready')
) AS s(team_id, owner_user_id, title, status)
WHERE NOT EXISTS (
  SELECT 1 FROM okr_draft_sessions d WHERE d.team_id = s.team_id AND d.title = s.title
);

WITH draft_ids AS (
  SELECT id, team_id FROM okr_draft_sessions
  WHERE title IN ('Q3 reliability uplift draft', 'Q3 pipeline quality draft', 'Q3 support turnaround draft')
),
seed AS (
  SELECT d.id AS draft_session_id,
         CASE d.team_id
           WHEN 'team_product' THEN '{"objective":"Improve platform reliability for enterprise customers","timeframe":"Q3 2026","keyResults":[{"title":"Reduce Sev1 incidents from 5 to 2","targetValue":2,"currentValue":5,"unit":"incidents/quarter"},{"title":"Increase uptime from 99.5 to 99.9","targetValue":99.9,"currentValue":99.5,"unit":"%"},{"title":"Reduce P95 API latency from 620 to 380","targetValue":380,"currentValue":620,"unit":"ms"}]}'::jsonb
           WHEN 'team_sales' THEN '{"objective":"Increase qualified pipeline consistency","timeframe":"Q3 2026","keyResults":[{"title":"Increase weekly SQLs from 12 to 20","targetValue":20,"currentValue":12,"unit":"SQLs/week"},{"title":"Increase trial-to-paid conversion from 14 to 19","targetValue":19,"currentValue":14,"unit":"%"},{"title":"Reduce stale opportunities from 41 to 20","targetValue":20,"currentValue":41,"unit":"opportunities"}]}'::jsonb
           ELSE '{"objective":"Reduce support turnaround and backlog risk","timeframe":"Q3 2026","keyResults":[{"title":"Reduce median response time from 7 to 4","targetValue":4,"currentValue":7,"unit":"hours"},{"title":"Reduce backlog older than 3 days from 42 to 18","targetValue":18,"currentValue":42,"unit":"tickets"},{"title":"Increase first-contact resolution from 58 to 72","targetValue":72,"currentValue":58,"unit":"%"}]}'::jsonb
         END AS draft_json,
         CASE d.team_id
           WHEN 'team_product' THEN 'mgr_product'
           WHEN 'team_sales' THEN 'mgr_sales'
           ELSE 'mgr_ops'
         END AS actor
  FROM draft_ids d
)
INSERT INTO okr_draft_versions (draft_session_id, version_number, source, summary, draft_json, metadata_json, created_by_user_id)
SELECT s.draft_session_id, 1, 'system', 'Seeded initial draft version', s.draft_json, '{"seed":true}'::jsonb, s.actor
FROM seed s
WHERE NOT EXISTS (
  SELECT 1 FROM okr_draft_versions v WHERE v.draft_session_id = s.draft_session_id AND v.version_number = 1
);

UPDATE okr_draft_sessions d
SET current_version_id = v.id,
    updated_at = NOW()
FROM okr_draft_versions v
WHERE v.draft_session_id = d.id
  AND v.version_number = 1
  AND d.current_version_id IS NULL;
