#!/usr/bin/env node
import pg from 'pg';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://okr:okr@localhost:5432/okr_copilot?schema=public';
const pool = new Pool({ connectionString: databaseUrl });

const teams = [
  ['team_product', 'Product'],
  ['team_sales', 'Sales'],
  ['team_ops', 'Operations']
];

const users = [
  ['mgr_product', 'mgr.product@demo.local', 'Maya Manager'],
  ['member_sales', 'member.sales@demo.local', 'Sam Team Member'],
  ['leader_exec', 'leader.exec@demo.local', 'Lee Senior Leader']
];

const memberships = [
  ['mgr_product', 'team_product', 'manager'],
  ['member_sales', 'team_sales', 'team_member'],
  ['leader_exec', 'team_product', 'senior_leader'],
  ['leader_exec', 'team_sales', 'senior_leader'],
  ['leader_exec', 'team_ops', 'senior_leader']
];

const okrSeeds = [
  ['mgr_product', 'team_product', 'Improve product reliability', 'Reduce Sev1 incidents', 1, 3, 'incidents'],
  ['member_sales', 'team_sales', 'Increase pipeline quality', 'Raise SQL to win conversion', 30, 21, '%'],
  ['mgr_product', 'team_ops', 'Reduce support turnaround', 'Cut median response time', 4, 7, 'hours']
];

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [id, name] of teams) {
      await client.query('INSERT INTO teams (id, name) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING', [id, name]);
    }

    for (const [id, email, displayName] of users) {
      await client.query(
        'INSERT INTO users (id, email, display_name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
        [id, email, displayName]
      );
    }

    for (const [userId, teamId, role] of memberships) {
      await client.query(
        'INSERT INTO team_memberships (user_id, team_id, role) VALUES ($1, $2, $3) ON CONFLICT (user_id, team_id) DO NOTHING',
        [userId, teamId, role]
      );
    }

    for (const [userId, teamId, objective, krTitle, targetValue, currentValue, unit] of okrSeeds) {
      const existingOkr = await client.query('SELECT id FROM okrs WHERE team_id = $1 AND objective = $2 LIMIT 1', [teamId, objective]);
      const okrId = existingOkr.rowCount
        ? Number(existingOkr.rows[0].id)
        : Number(
            (
              await client.query(
                `INSERT INTO okrs (user_id, team_id, objective, timeframe)
                 VALUES ($1, $2, $3, 'Q2 2026')
                 RETURNING id`,
                [userId, teamId, objective]
              )
            ).rows[0].id
          );

      const existingKr = await client.query('SELECT id FROM key_results WHERE okr_id = $1 AND title = $2 LIMIT 1', [okrId, krTitle]);
      if (!existingKr.rowCount) {
        await client.query(
          `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
           VALUES ($1, $2, $3, $4, $5, 0)`,
          [okrId, krTitle, targetValue, currentValue, unit]
        );
      }
    }

    await client.query('COMMIT');
    console.log('RBAC_DEMO_SEED_OK');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
