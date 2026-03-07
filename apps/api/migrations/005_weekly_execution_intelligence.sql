ALTER TABLE kr_checkins
  ADD COLUMN IF NOT EXISTS progress_delta NUMERIC,
  ADD COLUMN IF NOT EXISTS confidence SMALLINT,
  ADD COLUMN IF NOT EXISTS blocker_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS note TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'kr_checkins' AND column_name = 'commentary'
  ) THEN
    UPDATE kr_checkins
    SET note = COALESCE(note, commentary)
    WHERE note IS NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kr_checkins_confidence ON kr_checkins(confidence);
CREATE INDEX IF NOT EXISTS idx_kr_checkins_blocker_tags ON kr_checkins USING GIN(blocker_tags);

-- Seed additional users and memberships for richer demo across multiple teams.
INSERT INTO users (id, email, display_name)
VALUES
  ('mgr_sales', 'mgr.sales@demo.local', 'Sana Sales Manager'),
  ('mgr_ops', 'mgr.ops@demo.local', 'Owen Ops Manager'),
  ('member_product', 'member.product@demo.local', 'Priya Product Contributor'),
  ('member_ops', 'member.ops@demo.local', 'Oscar Ops Contributor')
ON CONFLICT (id) DO NOTHING;

INSERT INTO team_memberships (user_id, team_id, role)
VALUES
  ('mgr_sales', 'team_sales', 'manager'),
  ('mgr_ops', 'team_ops', 'manager'),
  ('member_product', 'team_product', 'team_member'),
  ('member_ops', 'team_ops', 'team_member')
ON CONFLICT (user_id, team_id) DO NOTHING;

-- Seed structured check-ins for trend and risk demos.
WITH target_krs AS (
  SELECT kr.id, o.team_id, kr.target_value
  FROM key_results kr
  JOIN okrs o ON o.id = kr.okr_id
  WHERE o.team_id IN ('team_product', 'team_sales', 'team_ops')
)
INSERT INTO kr_checkins (key_result_id, value, commentary, note, progress_delta, confidence, blocker_tags, source, created_by_user_id, created_at)
SELECT
  t.id,
  CASE t.team_id
    WHEN 'team_product' THEN GREATEST(0, t.target_value * 0.55)
    WHEN 'team_sales' THEN GREATEST(0, t.target_value * 0.62)
    ELSE GREATEST(0, t.target_value * 0.5)
  END,
  'Seeded weekly check-in',
  CASE t.team_id
    WHEN 'team_product' THEN 'Latency spike under investigation'
    WHEN 'team_sales' THEN 'Pipeline quality improving'
    ELSE 'Hiring dependency delaying progress'
  END,
  CASE t.team_id
    WHEN 'team_product' THEN -2
    WHEN 'team_sales' THEN 3
    ELSE -1
  END,
  CASE t.team_id
    WHEN 'team_product' THEN 2
    WHEN 'team_sales' THEN 4
    ELSE 3
  END,
  CASE t.team_id
    WHEN 'team_product' THEN ARRAY['dependency','capacity']::text[]
    WHEN 'team_sales' THEN ARRAY[]::text[]
    ELSE ARRAY['staffing']::text[]
  END,
  'seed',
  CASE t.team_id
    WHEN 'team_product' THEN 'member_product'
    WHEN 'team_sales' THEN 'member_sales'
    ELSE 'member_ops'
  END,
  NOW() - INTERVAL '7 days'
FROM target_krs t
WHERE NOT EXISTS (
  SELECT 1 FROM kr_checkins c WHERE c.key_result_id = t.id AND c.source = 'seed'
);

WITH target_krs AS (
  SELECT kr.id, o.team_id, kr.target_value
  FROM key_results kr
  JOIN okrs o ON o.id = kr.okr_id
  WHERE o.team_id IN ('team_product', 'team_sales', 'team_ops')
)
INSERT INTO kr_checkins (key_result_id, value, commentary, note, progress_delta, confidence, blocker_tags, source, created_by_user_id, created_at)
SELECT
  t.id,
  CASE t.team_id
    WHEN 'team_product' THEN GREATEST(0, t.target_value * 0.48)
    WHEN 'team_sales' THEN GREATEST(0, t.target_value * 0.71)
    ELSE GREATEST(0, t.target_value * 0.53)
  END,
  'Seeded weekly check-in',
  CASE t.team_id
    WHEN 'team_product' THEN 'Blocked by upstream platform migration'
    WHEN 'team_sales' THEN 'Strong customer response this week'
    ELSE 'Support queue remains stable'
  END,
  CASE t.team_id
    WHEN 'team_product' THEN -3
    WHEN 'team_sales' THEN 4
    ELSE 1
  END,
  CASE t.team_id
    WHEN 'team_product' THEN 2
    WHEN 'team_sales' THEN 4
    ELSE 3
  END,
  CASE t.team_id
    WHEN 'team_product' THEN ARRAY['dependency','technical_debt']::text[]
    WHEN 'team_sales' THEN ARRAY[]::text[]
    ELSE ARRAY['process']::text[]
  END,
  'seed',
  CASE t.team_id
    WHEN 'team_product' THEN 'member_product'
    WHEN 'team_sales' THEN 'member_sales'
    ELSE 'member_ops'
  END,
  NOW()
FROM target_krs t
WHERE NOT EXISTS (
  SELECT 1 FROM kr_checkins c WHERE c.key_result_id = t.id AND c.source = 'seed' AND c.created_at > NOW() - INTERVAL '1 day'
);
