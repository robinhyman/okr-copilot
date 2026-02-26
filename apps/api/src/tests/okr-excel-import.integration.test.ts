import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import request from 'supertest';
import * as XLSX from 'xlsx';
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

function makeWorkbook(rows: Array<Record<string, unknown>>): Buffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
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

test('excel preview + apply happy path', async () => {
  const app = createApp();

  const createRes = await request(app)
    .post('/api/okrs')
    .set(authHeaders)
    .send({
      objective: 'Client delivery quality',
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
  assert.equal(createRes.status, 201);
  const krId = Number(createRes.body?.okr?.keyResults?.[0]?.id);

  const workbook = makeWorkbook([
    {
      objective: 'Client delivery quality',
      key_result: 'Ship weekly client outcomes summary',
      value: 5,
      commentary: 'Imported from sponsor timesheet',
      timestamp: '2026-02-26T10:00:00Z'
    }
  ]);

  const previewRes = await request(app)
    .post('/api/okrs/import/excel/preview')
    .set(authHeaders)
    .attach('file', workbook, 'checkins.xlsx');

  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body?.ok, true);
  assert.equal(previewRes.body?.preview?.summary?.readyToApply, 1);
  assert.equal(previewRes.body?.preview?.rows?.[0]?.keyResultId, krId);

  const applyRes = await request(app)
    .post('/api/okrs/import/excel/apply')
    .set(authHeaders)
    .field('selectedRowNumbers', '2')
    .attach('file', workbook, 'checkins.xlsx');

  assert.equal(applyRes.status, 200);
  assert.equal(applyRes.body?.ok, true);
  assert.equal(applyRes.body?.result?.appliedCount, 1);

  const historyRes = await request(app).get(`/api/key-results/${krId}/checkins`).set(authHeaders);
  assert.equal(historyRes.status, 200);
  assert.equal(historyRes.body?.checkins?.[0]?.source, 'excel_import');
  assert.equal(historyRes.body?.checkins?.[0]?.value, 5);
});

test('excel import invalid file and row errors', async () => {
  const app = createApp();

  await request(app)
    .post('/api/okrs')
    .set(authHeaders)
    .send({
      objective: 'Ops',
      timeframe: 'Q2 2026',
      keyResults: [{ title: 'Known KR', targetValue: 10, currentValue: 1, unit: 'points' }]
    });

  const invalidFileRes = await request(app)
    .post('/api/okrs/import/excel/preview')
    .set(authHeaders)
    .attach('file', Buffer.from('not-an-xlsx'), 'broken.xlsx');

  assert.equal(invalidFileRes.status, 400);
  assert.equal(invalidFileRes.body?.error, 'invalid_file');

  const workbookWithErrors = makeWorkbook([
    {
      objective: 'Ops',
      key_result: 'Unknown KR',
      value: 'abc',
      commentary: 'bad row'
    }
  ]);

  const previewRes = await request(app)
    .post('/api/okrs/import/excel/preview')
    .set(authHeaders)
    .attach('file', workbookWithErrors, 'rows.xlsx');

  assert.equal(previewRes.status, 200);
  assert.equal(previewRes.body?.preview?.summary?.invalidRows, 1);
  assert.ok(previewRes.body?.preview?.rows?.[0]?.errors?.some((e: any) => e.code === 'invalid_value'));
  assert.ok(previewRes.body?.preview?.rows?.[0]?.errors?.some((e: any) => e.code === 'key_result_not_found'));

  const applyRes = await request(app)
    .post('/api/okrs/import/excel/apply')
    .set(authHeaders)
    .attach('file', workbookWithErrors, 'rows.xlsx');

  assert.equal(applyRes.status, 200);
  assert.equal(applyRes.body?.result?.appliedCount, 0);
});
