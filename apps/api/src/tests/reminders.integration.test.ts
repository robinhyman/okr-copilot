import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import { ensureRemindersTable, getReminderById, createReminder } from '../data/reminders-repo.js';
import { ensureMessageEventsTable } from '../data/message-events-repo.js';
import { runDueReminderCycle } from '../services/reminders/reminder-worker.js';
import { createApp } from '../app.js';

const { Pool } = pg;
const databaseUrl =
  process.env.DATABASE_URL ?? 'postgresql://okr:okr@localhost:5432/okr_copilot?schema=public';
const pool = new Pool({ connectionString: databaseUrl });

const authHeaders = {
  'x-auth-stub-token': process.env.AUTH_STUB_TOKEN ?? 'dev-stub-token'
};

async function resetTables() {
  await pool.query('TRUNCATE TABLE message_events RESTART IDENTITY');
  await pool.query('TRUNCATE TABLE reminders RESTART IDENTITY');
}

test.before(async () => {
  await ensureMessageEventsTable();
  await ensureRemindersTable();
  await resetTables();
});

test.after(async () => {
  await pool.end();
});

test.beforeEach(async () => {
  await resetTables();
});

test('retry scheduling on failure uses deterministic backoff', async () => {
  const dueAtIso = new Date(Date.now() - 60_000).toISOString();
  const created = await createReminder({ recipient: 'whatsapp:+447000000001', message: 'retry me', dueAtIso });

  const first = await runDueReminderCycle(10, {
    async sendTest() {
      throw new Error('simulated_transport_failure');
    }
  });

  assert.equal(first.processed, 1);
  assert.equal(first.failed, 1);

  const reminder = await getReminderById(created.id);
  assert.equal(reminder?.status, 'retry_scheduled');
  assert.equal(reminder?.attempt_count, 1);
  assert.ok(reminder?.next_attempt_at, 'expected next_attempt_at after first failure');

  const nextAttempt = new Date(reminder.next_attempt_at).getTime();
  const diffMs = nextAttempt - Date.now();
  assert.ok(diffMs > 20_000 && diffMs < 90_000, `expected ~1m backoff, got ${diffMs}ms`);
});

test('eventual sent state on success after a retry', async () => {
  const dueAtIso = new Date(Date.now() - 60_000).toISOString();
  const created = await createReminder({ recipient: 'whatsapp:+447000000002', message: 'send me', dueAtIso });

  await runDueReminderCycle(10, {
    async sendTest() {
      throw new Error('first_failure');
    }
  });

  await pool.query(`UPDATE reminders SET next_attempt_at = NOW() - INTERVAL '1 second' WHERE id = $1`, [created.id]);

  const second = await runDueReminderCycle(10, {
    async sendTest() {
      return { sid: 'SM_success_after_retry', status: 'queued' };
    }
  });

  assert.equal(second.processed, 1);
  assert.equal(second.sent, 1);

  const reminder = await getReminderById(created.id);
  assert.equal(reminder?.status, 'sent');
  assert.equal(reminder?.outbound_sid, 'SM_success_after_retry');
  assert.equal(reminder?.attempt_count, 1);
});

test('duplicate status callback handling is idempotent', async () => {
  const created = await createReminder({
    recipient: 'whatsapp:+447000000003',
    message: 'status callback',
    dueAtIso: new Date(Date.now() - 60_000).toISOString()
  });

  await runDueReminderCycle(10, {
    async sendTest() {
      return { sid: 'SM_dupe_status_1', status: 'queued' };
    }
  });

  const app = createApp();

  const firstRes = await request(app).post('/api/reminders/whatsapp/status').type('form').send({
    MessageSid: 'SM_dupe_status_1',
    MessageStatus: 'delivered',
    To: 'whatsapp:+447000000003'
  });
  assert.equal(firstRes.status, 200);

  const secondRes = await request(app).post('/api/reminders/whatsapp/status').type('form').send({
    MessageSid: 'SM_dupe_status_1',
    MessageStatus: 'delivered',
    To: 'whatsapp:+447000000003'
  });
  assert.equal(secondRes.status, 200);

  const reminder = await getReminderById(created.id);
  assert.equal(reminder?.status, 'sent');
  assert.equal(reminder?.provider_status, 'delivered');
});

test('invalid dueAtIso returns 400', async () => {
  const app = createApp();

  const response = await request(app)
    .post('/api/reminders')
    .set(authHeaders)
    .send({
      recipient: 'whatsapp:+447000000004',
      message: 'bad due date',
      dueAtIso: 'not-a-date'
    });

  assert.equal(response.status, 400);
  assert.equal(response.body?.ok, false);
  assert.equal(response.body?.error, 'invalid_dueAtIso');
});
