import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';

const { Pool } = pg;
const databaseUrl = process.env.DATABASE_URL ?? 'postgresql://okr:okr@localhost:5432/okr_copilot?schema=public';
const pool = new Pool({ connectionString: databaseUrl });

async function resetTables() {
  await pool.query('TRUNCATE TABLE kr_checkins, key_results, okrs RESTART IDENTITY CASCADE');
}

async function seedTeamOkr(teamId: string, userId: string, objective: string): Promise<number> {
  const okrRes = await pool.query(
    `INSERT INTO okrs (user_id, team_id, objective, timeframe) VALUES ($1, $2, $3, 'Q2 2026') RETURNING id`,
    [userId, teamId, objective]
  );
  const okrId = Number(okrRes.rows[0].id);
  const krRes = await pool.query(
    `INSERT INTO key_results (okr_id, title, target_value, current_value, unit, sort_order)
     VALUES ($1, 'Demo KR', 10, 2, 'pts', 0)
     RETURNING id`,
    [okrId]
  );
  return Number(krRes.rows[0].id);
}

const baseHeaders = {
  'x-auth-stub-token': process.env.AUTH_STUB_TOKEN ?? 'dev-stub-token'
};

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

test('manager can create OKRs in own team', async () => {
  const app = createApp();
  const res = await request(app)
    .post('/api/okrs')
    .set(baseHeaders)
    .set('x-auth-user-id', 'mgr_product')
    .set('x-auth-team-id', 'team_product')
    .send({
      objective: 'Manager objective',
      timeframe: 'Q2 2026',
      keyResults: [{ title: 'KR 1', targetValue: 5, currentValue: 1, unit: 'pts' }]
    });

  assert.equal(res.status, 201);
  assert.equal(res.body?.ok, true);
});

test('team member cannot create/edit OKRs but can check in', async () => {
  const app = createApp();
  const salesKrId = await seedTeamOkr('team_sales', 'member_sales', 'Sales objective');

  const createRes = await request(app)
    .post('/api/okrs')
    .set(baseHeaders)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales')
    .send({
      objective: 'Should fail',
      timeframe: 'Q2 2026',
      keyResults: [{ title: 'KR 1', targetValue: 5, currentValue: 1, unit: 'pts' }]
    });
  assert.equal(createRes.status, 403);

  const checkinRes = await request(app)
    .post(`/api/key-results/${salesKrId}/checkins`)
    .set(baseHeaders)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales')
    .send({ value: 4, commentary: 'Updated by team member' });

  assert.equal(checkinRes.status, 201);
});

test('team member can manage drafts but cannot publish draft', async () => {
  const app = createApp();

  const createDraft = await request(app)
    .post('/api/okr-drafts/sessions')
    .set(baseHeaders)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales')
    .send({ title: 'Member draft' });

  assert.equal(createDraft.status, 201);
  const draftId = Number(createDraft.body?.session?.id);

  const saveDraft = await request(app)
    .post(`/api/okr-drafts/${draftId}/versions`)
    .set(baseHeaders)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales')
    .send({
      draft: {
        objective: 'Improve sales qualification quality',
        timeframe: 'Q2 2026',
        keyResults: [{ title: 'Increase SQL conversion from 10 to 15', targetValue: 15, currentValue: 10, unit: '%' }]
      }
    });
  assert.equal(saveDraft.status, 201);

  const publishAttempt = await request(app)
    .post(`/api/okr-drafts/${draftId}/publish`)
    .set(baseHeaders)
    .set('x-auth-user-id', 'member_sales')
    .set('x-auth-team-id', 'team_sales')
    .send({});

  assert.equal(publishAttempt.status, 403);
});

test('senior leader has cross-team read-only access', async () => {
  const app = createApp();
  await seedTeamOkr('team_product', 'mgr_product', 'Product objective');
  const salesKrId = await seedTeamOkr('team_sales', 'member_sales', 'Sales objective');

  const listRes = await request(app)
    .get('/api/okrs')
    .set(baseHeaders)
    .set('x-auth-user-id', 'leader_exec')
    .set('x-auth-team-id', 'team_product');

  assert.equal(listRes.status, 200);
  assert.ok((listRes.body?.okrs ?? []).length >= 2);

  const checkinsRes = await request(app)
    .get(`/api/key-results/${salesKrId}/checkins`)
    .set(baseHeaders)
    .set('x-auth-user-id', 'leader_exec')
    .set('x-auth-team-id', 'team_product');
  assert.equal(checkinsRes.status, 200);

  const forbiddenWrite = await request(app)
    .post(`/api/key-results/${salesKrId}/checkins`)
    .set(baseHeaders)
    .set('x-auth-user-id', 'leader_exec')
    .set('x-auth-team-id', 'team_product')
    .send({ value: 8, commentary: 'Should not be allowed' });

  assert.equal(forbiddenWrite.status, 403);
});
