import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import { createApp } from '../app.js';
import { runMigrations } from '../db/migrate.js';

const { Pool } = pg;
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://okr:okr@localhost:5432/okr_copilot?schema=public';
const pool = new Pool({ connectionString: databaseUrl });

const authHeaders = {
  'x-auth-stub-token': process.env.AUTH_STUB_TOKEN ?? 'dev-stub-token'
};

async function resetTables() {
  await pool.query('TRUNCATE TABLE kr_checkins, key_results, okrs RESTART IDENTITY CASCADE');
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

test('draft -> save -> fetch -> check-in happy path', async () => {
  const app = createApp();

  const draftRes = await request(app).post('/api/okrs/draft').send({
    focusArea: 'Client delivery',
    timeframe: 'Q2 2026'
  });
  assert.equal(draftRes.status, 200);
  assert.equal(draftRes.body?.ok, true);
  assert.ok(draftRes.body?.draft?.keyResults?.length > 0);

  const createRes = await request(app)
    .post('/api/okrs')
    .set(authHeaders)
    .send(draftRes.body.draft);
  assert.equal(createRes.status, 201);
  const okrId = Number(createRes.body?.okr?.id);
  const keyResultId = Number(createRes.body?.okr?.keyResults?.[0]?.id);
  assert.ok(Number.isFinite(okrId));
  assert.ok(Number.isFinite(keyResultId));

  const updateRes = await request(app)
    .put(`/api/okrs/${okrId}`)
    .set(authHeaders)
    .send({
      objective: 'Improve client delivery outcomes',
      timeframe: 'Q2 2026',
      keyResults: [
        {
          title: 'Ship weekly client outcomes summary',
          targetValue: 12,
          currentValue: 2,
          unit: 'summaries'
        }
      ]
    });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.body?.okr?.objective, 'Improve client delivery outcomes');

  const refreshedKrId = Number(updateRes.body?.okr?.keyResults?.[0]?.id);

  const checkinRes = await request(app)
    .post(`/api/key-results/${refreshedKrId}/checkins`)
    .set(authHeaders)
    .send({ value: 4, commentary: 'Two additional updates shipped this week.' });
  assert.equal(checkinRes.status, 201);

  const listRes = await request(app).get('/api/okrs');
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body?.ok, true);
  assert.equal(listRes.body?.okrs?.[0]?.keyResults?.[0]?.current_value, 4);
});
