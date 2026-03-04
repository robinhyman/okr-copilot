import { expect, test } from '@playwright/test';

const apiBase = process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:4000';
const authHeaders = {
  'content-type': 'application/json',
  'x-auth-stub-token': 'dev-stub-token'
};

async function seedSingleKr() {
  const listRes = await fetch(`${apiBase}/api/okrs`, { headers: { 'x-auth-stub-token': 'dev-stub-token' } });
  const listJson = await listRes.json();
  const existing = listJson.okrs?.[0];

  const payload = {
    objective: 'E2E Confidence Objective',
    timeframe: 'Q2 2026',
    keyResults: [{ title: 'E2E KR Throughput', currentValue: 1, targetValue: 10, unit: 'units' }]
  };

  if (existing?.id) {
    const updateRes = await fetch(`${apiBase}/api/okrs/${existing.id}`, {
      method: 'PUT',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });
    if (!updateRes.ok) throw new Error(`seed_update_failed_${updateRes.status}`);
  } else {
    const createRes = await fetch(`${apiBase}/api/okrs`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify(payload)
    });
    if (!createRes.ok) throw new Error(`seed_create_failed_${createRes.status}`);
  }

  const refreshed = await fetch(`${apiBase}/api/okrs`, { headers: { 'x-auth-stub-token': 'dev-stub-token' } });
  const refreshedJson = await refreshed.json();
  const krId = refreshedJson.okrs?.[0]?.keyResults?.[0]?.id;
  if (!krId) throw new Error('seed_missing_kr_id');
  return Number(krId);
}

test.beforeEach(async ({ page }) => {
  await seedSingleKr();
  const okrsResponsePromise = page.waitForResponse((res) => res.url().includes('/api/okrs') && res.request().method() === 'GET');
  await page.goto('/checkins');
  const okrsResponse = await okrsResponsePromise;
  expect(okrsResponse.status()).toBe(200);
});

test('happy path: check-in completion shows route-scoped feedback lifecycle', async ({ page }, testInfo) => {
  const row = page.locator('[data-testid^="checkin-row-"]').first();
  await expect(row).toBeVisible();

  const submitButton = row.locator('[data-testid^="submit-checkin-"]');
  await row.locator('[data-testid^="checkin-value-"]').fill('3');
  await row.locator('[data-testid^="checkin-commentary-"]').fill('Progress this week');

  await submitButton.click();

  const checkinsFeedback = page.getByTestId('route-feedback-checkins');
  await expect(checkinsFeedback).toContainText('Check-in saved.');

  await page.getByTestId('nav-overview').click();
  await expect(page.getByTestId('route-feedback-overview')).toHaveCount(0);

  await page.getByTestId('nav-checkins').click();
  await expect(checkinsFeedback).toContainText('Check-in saved.');
  await expect(checkinsFeedback).toBeHidden({ timeout: 7_000 });

  await page.screenshot({ path: testInfo.outputPath('happy-path-feedback-lifecycle.png'), fullPage: true });
});

test('guardrail: duplicate submit is blocked per KR', async ({ page }, testInfo) => {
  const row = page.locator('[data-testid^="checkin-row-"]').first();
  await expect(row).toBeVisible();

  const submitButton = row.locator('[data-testid^="submit-checkin-"]');
  const valueInput = row.locator('[data-testid^="checkin-value-"]');
  const commentaryInput = row.locator('[data-testid^="checkin-commentary-"]');
  const history = row.locator('[data-testid^="checkin-history-"] li');

  await valueInput.fill('4');
  await commentaryInput.fill('Double click attempt');

  let checkinPostCount = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && /\/api\/key-results\/\d+\/checkins$/.test(request.url())) {
      checkinPostCount += 1;
    }
  });

  await submitButton.dblclick();
  await expect(page.getByTestId('route-feedback-checkins')).toContainText('Check-in saved.');

  expect(checkinPostCount).toBe(1);
  await expect(history.first()).toContainText('Double click attempt');
  await expect(submitButton).toBeEnabled();

  await page.screenshot({ path: testInfo.outputPath('guardrail-no-duplicate-submit.png'), fullPage: true });
});
