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
  assert.ok(['llm', 'fallback'].includes(draftRes.body?.metadata?.source));

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

  const historyRes = await request(app)
    .get(`/api/key-results/${refreshedKrId}/checkins?limit=5`)
    .set(authHeaders);
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body?.ok, true);
  assert.equal(historyRes.body?.checkins?.[0]?.value, 4);

  const listRes = await request(app).get('/api/okrs').set(authHeaders);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body?.ok, true);
  assert.equal(listRes.body?.okrs?.[0]?.keyResults?.[0]?.current_value, 4);
});

test('draft falls back deterministically when OPENAI_API_KEY is missing', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const res = await request(app).post('/api/okrs/draft').send({
      focusArea: 'Revenue operations',
      timeframe: 'Q3 2026'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.metadata?.source, 'fallback');
    assert.equal(res.body?.metadata?.provider, 'deterministic');
    assert.equal(res.body?.metadata?.reason, 'missing_openai_api_key');
    assert.equal(res.body?.draft?.timeframe, 'Q3 2026');
    assert.ok(Array.isArray(res.body?.draft?.keyResults));
  } finally {
    if (priorKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = priorKey;
    }
  }
});

test('draft falls back when LLM provider call fails', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  const priorBaseUrl = process.env.OPENAI_BASE_URL;
  const priorTimeout = process.env.OKR_DRAFT_LLM_TIMEOUT_MS;

  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'http://127.0.0.1:1/v1';
  process.env.OKR_DRAFT_LLM_TIMEOUT_MS = '200';

  try {
    const app = createApp();
    const res = await request(app).post('/api/okrs/draft').send({
      focusArea: 'Delivery quality',
      timeframe: 'Q4 2026'
    });

    assert.equal(res.status, 200);
    assert.equal(res.body?.ok, true);
    assert.equal(res.body?.metadata?.source, 'fallback');
    assert.equal(res.body?.metadata?.provider, 'deterministic');
    assert.ok(typeof res.body?.metadata?.reason === 'string');
    assert.ok(Array.isArray(res.body?.draft?.keyResults));
    assert.ok(res.body?.draft?.keyResults?.length > 0);
  } finally {
    if (priorKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = priorKey;
    }

    if (priorBaseUrl === undefined) {
      delete process.env.OPENAI_BASE_URL;
    } else {
      process.env.OPENAI_BASE_URL = priorBaseUrl;
    }

    if (priorTimeout === undefined) {
      delete process.env.OKR_DRAFT_LLM_TIMEOUT_MS;
    } else {
      process.env.OKR_DRAFT_LLM_TIMEOUT_MS = priorTimeout;
    }
  }
});

test('chat endpoint refines a draft and returns assistant message', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const draftRes = await request(app).post('/api/okrs/draft').send({
      focusArea: 'Client delivery',
      timeframe: 'Q2 2026'
    });

    assert.equal(draftRes.status, 200);

    const firstChatRes = await request(app)
      .post('/api/okrs/chat')
      .send({
        draft: draftRes.body?.draft,
        messages: [{ role: 'user', content: 'make all key results measurable and reduce ambition by 20%' }]
      });

    assert.equal(firstChatRes.status, 200);
    assert.equal(firstChatRes.body?.ok, true);
    assert.ok(['questions', 'refine'].includes(firstChatRes.body?.mode));

    const chatRes =
      firstChatRes.body?.mode === 'refine'
        ? firstChatRes
        : await request(app)
            .post('/api/okrs/chat')
            .send({
              draft: firstChatRes.body?.draft,
              messages: [
                { role: 'user', content: 'make all key results measurable and reduce ambition by 20%' },
                { role: 'assistant', content: firstChatRes.body?.assistantMessage || '' },
                { role: 'user', content: 'Baseline is 3 shipped playbooks per quarter, target 5 this quarter.' }
              ]
            });

    assert.equal(chatRes.status, 200);
    assert.equal(chatRes.body?.ok, true);
    assert.equal(chatRes.body?.mode, 'refine');
    assert.equal(typeof chatRes.body?.assistantMessage, 'string');
    assert.ok(chatRes.body?.assistantMessage?.length > 0);
    assert.ok(Array.isArray(chatRes.body?.draft?.keyResults));
    assert.ok(chatRes.body?.draft?.keyResults?.length > 0);
    assert.ok(['llm', 'fallback'].includes(chatRes.body?.metadata?.source));
  } finally {
    if (priorKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = priorKey;
    }
  }
});

test('chat endpoint asks probing questions when context is underspecified', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const draftRes = await request(app).post('/api/okrs/draft').send({
      focusArea: 'Client delivery',
      timeframe: 'Q2 2026'
    });

    const chatRes = await request(app)
      .post('/api/okrs/chat')
      .send({
        draft: draftRes.body?.draft,
        messages: [{ role: 'user', content: 'help me improve this' }]
      });

    assert.equal(chatRes.status, 200);
    assert.equal(chatRes.body?.ok, true);
    assert.equal(chatRes.body?.mode, 'questions');
    assert.ok(Array.isArray(chatRes.body?.questions));
    assert.ok(chatRes.body?.questions?.length > 0);
  } finally {
    if (priorKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = priorKey;
    }
  }
});

test('read endpoints require auth and update missing OKR returns 404', async () => {
  const app = createApp();

  const noAuthList = await request(app).get('/api/okrs');
  assert.equal(noAuthList.status, 401);

  const noAuthHistory = await request(app).get('/api/key-results/1/checkins');
  assert.equal(noAuthHistory.status, 401);

  const missingUpdate = await request(app)
    .put('/api/okrs/999999')
    .set(authHeaders)
    .send({
      objective: 'Missing',
      timeframe: 'Q4',
      keyResults: [{ title: 'KR', targetValue: 1, currentValue: 0, unit: 'points' }]
    });

  assert.equal(missingUpdate.status, 404);
  assert.equal(missingUpdate.body?.error, 'okr_not_found');
});
