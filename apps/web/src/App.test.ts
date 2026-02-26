import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoutePath, validateDraft } from './lib/ui';

test('getRoutePath maps supported routes', () => {
  assert.equal(getRoutePath('/overview'), '/overview');
  assert.equal(getRoutePath('/okrs'), '/okrs');
  assert.equal(getRoutePath('/checkins'), '/checkins');
  assert.equal(getRoutePath('/anything-else'), '/overview');
});

test('validateDraft returns required field errors', () => {
  const errors = validateDraft({
    objective: '',
    timeframe: '',
    keyResults: [{ title: '', currentValue: 1, targetValue: 0, unit: '' }]
  });

  assert.ok(errors.length >= 4);
  assert.ok(errors.some((e) => e.includes('Objective')));
  assert.ok(errors.some((e) => e.includes('Timeframe')));
  assert.ok(errors.some((e) => e.includes('target value')));
});

test('validateDraft passes valid draft', () => {
  const errors = validateDraft({
    objective: 'Improve client delivery outcomes',
    timeframe: 'Q2 2026',
    keyResults: [{ title: 'Ship weekly updates', currentValue: 2, targetValue: 12, unit: 'updates' }]
  });

  assert.deepEqual(errors, []);
});
