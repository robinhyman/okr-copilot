import test from 'node:test';
import assert from 'node:assert/strict';
import { getRoutePath, validateDraft, validateObjectiveSet } from './lib/ui';
import { buildCreateFlowSeedMessage, formatTurnStatus } from './lib/coachStatus';

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

test('validateObjectiveSet enforces 5x5 constraints', () => {
  const tooManyObjectives = validateObjectiveSet({
    objectives: Array.from({ length: 6 }, (_, i) => ({
      objective: `Objective ${i + 1}`,
      timeframe: 'Q2',
      keyResults: [{ title: 'KR', currentValue: 0, targetValue: 1, unit: 'pts' }]
    }))
  });
  assert.ok(tooManyObjectives.some((e) => e.includes('No more than 5 objectives')));

  const tooManyKrs = validateObjectiveSet({
    objectives: [
      {
        objective: 'Objective 1',
        timeframe: 'Q2',
        keyResults: Array.from({ length: 6 }, (_, i) => ({ title: `KR ${i + 1}`, currentValue: 0, targetValue: 1, unit: 'pts' }))
      }
    ]
  });
  assert.ok(tooManyKrs.some((e) => e.includes('no more than 5 key results')));
});

test('create flow seed message is backend-oriented and does not inject old static assistant opener', () => {
  const seed = buildCreateFlowSeedMessage('team_product');
  assert.ok(seed.includes('team_product'));
  assert.ok(seed.toLowerCase().includes('start by coaching'));
  assert.notEqual(seed, 'What specific business outcome should this OKR move?');
});

test('formatTurnStatus surfaces metadata source and fallback reason', () => {
  assert.equal(formatTurnStatus({ source: 'llm' }), 'source: llm');
  assert.equal(formatTurnStatus({ source: 'fallback', reason: 'llm_timeout' }), 'source: fallback (llm_timeout)');
});

