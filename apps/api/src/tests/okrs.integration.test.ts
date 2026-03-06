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
                {
                  role: 'user',
                  content:
                    'Why: we need faster, more predictable delivery to improve competitiveness and protect renewals. Baseline is 3 shipped playbooks per quarter, target 5 this quarter. Constraints: team of 2 and no extra budget. Timeframe: Q2 2026.'
                }
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

test('wizard draft endpoint completes deterministically with full draft including KRs', async () => {
  const app = createApp();

  const res = await request(app)
    .post('/api/okrs/wizard-draft')
    .send({
      focusArea: 'Client delivery',
      timeframe: 'Q3 2026',
      baseline: 'Current baseline is 12 successful deliveries per month',
      constraints: 'Team of 4, fixed budget, no additional hires',
      objectiveStatement: 'Improve client delivery predictability and impact',
      keyResultCount: 3,
      aiAssist: false
    });

  assert.equal(res.status, 200);
  assert.equal(res.body?.ok, true);
  assert.equal(typeof res.body?.draft?.objective, 'string');
  assert.ok(Array.isArray(res.body?.draft?.keyResults));
  assert.equal(res.body?.draft?.keyResults?.length, 3);
  assert.equal(res.body?.metadata?.provider, 'deterministic');
});

test('wizard draft accepts structured baseline and remains backward compatible', async () => {
  const app = createApp();

  const structuredOnly = await request(app)
    .post('/api/okrs/wizard-draft')
    .send({
      focusArea: 'Client delivery',
      timeframe: 'Q3 2026',
      baselineStructured: { value: 12, unit: 'deliverables', period: 'month' },
      constraints: 'Team of 4, fixed budget, no additional hires',
      objectiveStatement: 'Improve client delivery predictability and impact',
      keyResultCount: 3,
      aiAssist: false
    });

  assert.equal(structuredOnly.status, 200);
  assert.equal(structuredOnly.body?.ok, true);
  assert.equal(structuredOnly.body?.draft?.keyResults?.[0]?.currentValue, 12);

  const legacyBaseline = await request(app)
    .post('/api/okrs/wizard-draft')
    .send({
      focusArea: 'Client delivery',
      timeframe: 'Q3 2026',
      baseline: 'Current baseline is 7 successful deliveries per month',
      constraints: 'Team of 4, fixed budget, no additional hires',
      objectiveStatement: 'Improve client delivery predictability and impact',
      keyResultCount: 3,
      aiAssist: false
    });

  assert.equal(legacyBaseline.status, 200);
  assert.equal(legacyBaseline.body?.ok, true);
  assert.equal(legacyBaseline.body?.draft?.keyResults?.[0]?.currentValue, 7);
});

test('chat refinement does not stay in repeated-question loop once full context is provided', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const draftRes = await request(app).post('/api/okrs/draft').send({
      focusArea: 'Client delivery',
      timeframe: 'Q2 2026'
    });

    const withFullContext = await request(app)
      .post('/api/okrs/chat')
      .send({
        draft: draftRes.body?.draft,
        messages: [
          {
            role: 'user',
            content:
              'Outcome: increase renewal rate. Why: improve retention economics and defend market share. Baseline: renewal is 78%. Target: 85% by end of Q2 2026. Constraints: team of 3 and fixed budget. Timeframe: Q2 2026. Please generate first draft now.'
          }
        ]
      });

    assert.equal(withFullContext.status, 200);
    assert.equal(withFullContext.body?.ok, true);
    assert.equal(withFullContext.body?.mode, 'refine');
    assert.ok(Array.isArray(withFullContext.body?.draft?.keyResults));
    assert.ok(withFullContext.body?.draft?.keyResults?.length > 0);
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

test('bulk upsert saves and reloads 5 objectives x 5 key results', async () => {
  const app = createApp();

  const objectives = Array.from({ length: 5 }, (_, objectiveIndex) => ({
    objective: `Objective ${objectiveIndex + 1}`,
    timeframe: 'Q2 2026',
    keyResults: Array.from({ length: 5 }, (_, krIndex) => ({
      title: `O${objectiveIndex + 1} KR ${krIndex + 1}`,
      targetValue: 10,
      currentValue: krIndex,
      unit: 'pts'
    }))
  }));

  const saveRes = await request(app)
    .post('/api/okrs/bulk-upsert')
    .set(authHeaders)
    .send({ objectives });

  assert.equal(saveRes.status, 200);
  assert.equal(saveRes.body?.okrs?.length, 5);
  assert.equal(saveRes.body?.okrs?.[0]?.keyResults?.length, 5);

  const listRes = await request(app).get('/api/okrs').set(authHeaders);
  assert.equal(listRes.status, 200);
  assert.equal(listRes.body?.okrs?.length, 5);
  assert.equal(listRes.body?.okrs?.[4]?.keyResults?.length, 5);
});

test('draft lifecycle: create session, refine via chat, save version, and publish', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const headers = { ...authHeaders, 'x-auth-user-id': 'mgr_product', 'x-auth-team-id': 'team_product' };

    const sessionRes = await request(app)
      .post('/api/okr-drafts/sessions')
      .set(headers)
      .send({ title: 'Lifecycle test draft' });

    assert.equal(sessionRes.status, 201);
    const draftId = Number(sessionRes.body?.session?.id);
    assert.ok(Number.isFinite(draftId));

    const chatRes = await request(app)
      .post(`/api/okr-drafts/${draftId}/chat`)
      .set(headers)
      .send({
        messages: [{ role: 'user', content: 'Outcome: reduce churn. Baseline: churn is 11%. Constraints: team of 3. Timeframe: Q3 2026.' }]
      });

    assert.equal(chatRes.status, 200);
    assert.equal(chatRes.body?.ok, true);
    assert.ok(chatRes.body?.draft?.objective);

    const saveRes = await request(app)
      .post(`/api/okr-drafts/${draftId}/versions`)
      .set(headers)
      .send({ draft: chatRes.body?.draft, status: 'ready', summary: 'Ready for publish' });

    assert.equal(saveRes.status, 201);

    const publishRes = await request(app)
      .post(`/api/okr-drafts/${draftId}/publish`)
      .set(headers)
      .send({});

    assert.equal(publishRes.status, 200);
    assert.equal(publishRes.body?.ok, true);
    assert.ok(Number.isFinite(Number(publishRes.body?.okr?.id)));
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorKey;
  }
});

test('coach anti-loop guard prevents consecutive duplicate assistant prompts', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const headers = { ...authHeaders, 'x-auth-user-id': 'mgr_product', 'x-auth-team-id': 'team_product' };

    const sessionRes = await request(app)
      .post('/api/okr-drafts/sessions')
      .set(headers)
      .send({ title: 'Anti-loop draft' });

    const draftId = Number(sessionRes.body?.session?.id);

    const turn1 = await request(app)
      .post(`/api/okr-drafts/${draftId}/chat`)
      .set(headers)
      .send({ messages: [{ role: 'user', content: 'Need help creating OKRs.' }] });

    const turn2 = await request(app)
      .post(`/api/okr-drafts/${draftId}/chat`)
      .set(headers)
      .send({
        messages: [
          { role: 'user', content: 'Need help creating OKRs.' },
          { role: 'assistant', content: turn1.body?.assistantMessage || '' },
          { role: 'user', content: 'Still need help creating OKRs.' }
        ]
      });

    assert.equal(turn1.status, 200);
    assert.equal(turn2.status, 200);
    assert.notEqual(String(turn1.body?.assistantMessage).trim(), String(turn2.body?.assistantMessage).trim());
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorKey;
  }
});

test('missing-context prompts are explicit and field-specific', async () => {
  const priorKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;

  try {
    const app = createApp();
    const headers = { ...authHeaders, 'x-auth-user-id': 'mgr_product', 'x-auth-team-id': 'team_product' };

    const sessionRes = await request(app)
      .post('/api/okr-drafts/sessions')
      .set(headers)
      .send({ title: 'Prompt-specificity draft' });

    const draftId = Number(sessionRes.body?.session?.id);

    const chatRes = await request(app)
      .post(`/api/okr-drafts/${draftId}/chat`)
      .set(headers)
      .send({ messages: [{ role: 'user', content: 'I want to improve things.' }] });

    assert.equal(chatRes.status, 200);
    const combined = `${chatRes.body?.assistantMessage || ''} ${(chatRes.body?.questions || []).join(' ')}`.toLowerCase();
    assert.ok(combined.includes('baseline') || combined.includes('target') || combined.includes('constraints'));
    assert.equal(combined.includes('need a bit more context'), false);
  } finally {
    if (priorKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = priorKey;
  }
});

test('bulk upsert enforces objective and KR limits', async () => {
  const app = createApp();

  const tooManyObjectives = await request(app)
    .post('/api/okrs/bulk-upsert')
    .set(authHeaders)
    .send({
      objectives: Array.from({ length: 6 }, (_, i) => ({
        objective: `Objective ${i + 1}`,
        timeframe: 'Q2',
        keyResults: [{ title: 'KR', targetValue: 1, currentValue: 0, unit: 'pts' }]
      }))
    });
  assert.equal(tooManyObjectives.status, 400);
  assert.equal(tooManyObjectives.body?.error, 'too_many_objectives');

  const tooManyKrs = await request(app)
    .post('/api/okrs/bulk-upsert')
    .set(authHeaders)
    .send({
      objectives: [
        {
          objective: 'Objective 1',
          timeframe: 'Q2',
          keyResults: Array.from({ length: 6 }, (_, i) => ({
            title: `KR ${i + 1}`,
            targetValue: 1,
            currentValue: 0,
            unit: 'pts'
          }))
        }
      ]
    });
  assert.equal(tooManyKrs.status, 400);
  assert.equal(tooManyKrs.body?.error, 'too_many_key_results');
});
