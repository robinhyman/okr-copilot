import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateFlowSeedMessage, formatTurnStatus } from './coachStatus';

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
