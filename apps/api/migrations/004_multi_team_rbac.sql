CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_memberships (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'team_member', 'senior_leader')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, team_id)
);

ALTER TABLE okrs ADD COLUMN IF NOT EXISTS team_id TEXT;
UPDATE okrs SET team_id = COALESCE(team_id, 'team_product');
ALTER TABLE okrs ALTER COLUMN team_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_okrs_team_created ON okrs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_memberships_user ON team_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team ON team_memberships(team_id);

INSERT INTO teams (id, name)
VALUES
  ('team_product', 'Product'),
  ('team_sales', 'Sales'),
  ('team_ops', 'Operations')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (id, email, display_name)
VALUES
  ('mgr_product', 'mgr.product@demo.local', 'Maya Manager'),
  ('member_sales', 'member.sales@demo.local', 'Sam Team Member'),
  ('leader_exec', 'leader.exec@demo.local', 'Lee Senior Leader')
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_memberships (user_id, team_id, role)
VALUES
  ('mgr_product', 'team_product', 'manager'),
  ('member_sales', 'team_sales', 'team_member'),
  ('leader_exec', 'team_product', 'senior_leader'),
  ('leader_exec', 'team_sales', 'senior_leader'),
  ('leader_exec', 'team_ops', 'senior_leader')
ON CONFLICT (user_id, team_id) DO NOTHING;

-- Seed one objective per team for demo visibility
INSERT INTO okrs (user_id, team_id, objective, timeframe)
SELECT * FROM (
  VALUES
    ('mgr_product', 'team_product', 'Improve product reliability', 'Q2 2026'),
    ('member_sales', 'team_sales', 'Increase pipeline quality', 'Q2 2026'),
    ('mgr_product', 'team_ops', 'Reduce support turnaround', 'Q2 2026')
) AS v(user_id, team_id, objective, timeframe)
WHERE NOT EXISTS (SELECT 1 FROM okrs o WHERE o.team_id = v.team_id AND o.objective = v.objective);

INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
SELECT o.id, s.title, s.target_value, s.current_value, s.unit, s.sort_order
FROM okrs o
JOIN (
  VALUES
    ('Improve product reliability', 'Reduce Sev1 incidents', 1, 3, 'incidents', 0),
    ('Increase pipeline quality', 'Raise SQL to win conversion', 30, 21, '%', 0),
    ('Reduce support turnaround', 'Cut median response time', 4, 7, 'hours', 0)
) AS s(objective, title, target_value, current_value, unit, sort_order)
  ON s.objective = o.objective
WHERE NOT EXISTS (
  SELECT 1 FROM key_results kr WHERE kr.okr_id = o.id AND kr.title = s.title
);
