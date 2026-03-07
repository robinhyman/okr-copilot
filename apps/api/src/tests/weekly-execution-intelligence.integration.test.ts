import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://okr:okr@localhost:5432/okr_copilot?schema=public';
const pool = new Pool({ connectionString: databaseUrl });

const headers = {
  'x-auth-stub-token': process.env.AUTH_STUB_TOKEN ?? 'dev-stub-token'
};

async function resetTables() {
  await pool.query('TRUNCATE TABLE kr_checkins, key_results, okrs RESTART IDENTITY CASCADE');
}

async function seedKr(teamId: string, userId: string): Promise<number> {
  const okrRes = await pool.query(
    `INSERT INTO okrs (user_id, team_id, objective, timeframe) VALUES ($1, $2, 'Demo objective', 'Q2 2026') RETURNING id`,
    [userId, teamId]
  );
  const krRes = await pool.query(
    `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
     VALUES ($1, 'Reduce incident rate from 8 to 3', 3, 8, 'incidents', 0)
     RETURNING id`,
    [okrRes.rows[0].id]
  );
  return Number(krRes.rows[0].id);
}

test.before(async () => {
  await runMigrations();
  await resetTables();
});

test.after(async () => {
  await pool.end();
});

test.beforeEach(async () => {
  await resetTables();
});

test('structured weekly check-in persists confidence/blockers/delta', async () => {
  const app = createApp();
  const krId = await seedKr('team_product', 'mgr_product');

  const saveRes = await request(app)
    .post(`/api/key-results/${krId}/checkins`)
    .set(headers)
    .set('x-auth-user-id', 'member_product')
    .set('x-auth-team-id', 'team_product')
    .send({ value: 6, progressDelta: -2, confidence: 2, blockerTags: ['dependency', 'capacity'], note: 'Blocked by platform migration' });

  assert.equal(saveRes.status, 201);

  const listRes = await request(app)
    .get(`/api/key-results/${krId}/checkins?limit=1`)
    .set(headers)
    .set('x-auth-user-id', 'mgr_product')
    .set('x-auth-team-id', 'team_product');

  assert.equal(listRes.status, 200);
  assert.equal(listRes.body?.checkins?.[0]?.confidence, 2);
  assert.equal(listRes.body?.checkins?.[0]?.progress_delta, -2);
  assert.deepEqual(listRes.body?.checkins?.[0]?.blocker_tags, ['dependency', 'capacity']);
});

test('manager digest and leader rollup are role scoped', async () => {
  const app = createApp();
  const krId = await seedKr('team_sales', 'mgr_sales');

  await request(app)
    .post(`/api/key-results/${krId}/checkins`)
    .set(headers)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales')
    .send({ value: 5, progressDelta: -1, confidence: 2, blockerTags: ['dependency'], note: 'Waiting on legal' });

  const managerDigest = await request(app)
    .get('/api/manager/digest')
    .set(headers)
    .set('x-auth-user-id', 'mgr_sales')
    .set('x-auth-team-id', 'team_sales');
  assert.equal(managerDigest.status, 200);
  assert.ok((managerDigest.body?.digest?.items ?? []).length >= 1);

  const teamMemberForbidden = await request(app)
    .get('/api/manager/digest')
    .set(headers)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales');
  assert.equal(teamMemberForbidden.status, 403);

  const leaderRollup = await request(app)
    .get('/api/leader/rollup')
    .set(headers)
    .set('x-auth-user-id', 'leader_exec')
    .set('x-auth-team-id', 'team_product');
  assert.equal(leaderRollup.status, 200);
  assert.ok(Array.isArray(leaderRollup.body?.rollup?.teams));

  const managerForbiddenLeaderEndpoint = await request(app)
    .get('/api/leader/rollup')
    .set(headers)
    .set('x-auth-user-id', 'mgr_sales')
    .set('x-auth-team-id', 'team_sales');
  assert.equal(managerForbiddenLeaderEndpoint.status, 403);
});

test('KR quality hints are non-blocking and manager-scoped', async () => {
  const app = createApp();
  const payload = {
    objectives: [
      {
        objective: 'Grow',
        timeframe: 'soon',
        keyResults: [{ title: 'Better outcomes', targetValue: 5, currentValue: 5, unit: 'points' }]
      }
    ]
  };

  const managerRes = await request(app)
    .post('/api/kr-quality/hints')
    .set(headers)
    .set('x-auth-user-id', 'mgr_product')
    .set('x-auth-team-id', 'team_product')
    .send(payload);

  assert.equal(managerRes.status, 200);
  assert.ok(managerRes.body?.hints?.[0]?.keyResults?.[0]?.hints?.length > 0);

  const memberRes = await request(app)
    .post('/api/kr-quality/hints')
    .set(headers)
    .set('x-auth-user-id', 'member_product')
    .set('x-auth-team-id', 'team_product')
    .send(payload);

  assert.equal(memberRes.status, 403);
});
