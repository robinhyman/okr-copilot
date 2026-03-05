import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore - gate helper is plain .mjs at repo root
import { gateConfigFromEnv } from '../../../../scripts/lib/quality-gates.mjs';

test('gateConfigFromEnv defaults keep strict demo gates on and llm requirement off', () => {
  const cfg = gateConfigFromEnv({});
  assert.equal(cfg.strict, true);
  assert.equal(cfg.coachLlmRequired, false);
  assert.equal(cfg.openAiKeyPresent, false);
});

test('gateConfigFromEnv honors explicit env values', () => {
  const cfg = gateConfigFromEnv({
    DEMO_STRICT_GATES: 'false',
    COACH_LLM_REQUIRED: 'true',
    OPENAI_API_KEY: 'sk-demo'
  });

  assert.equal(cfg.strict, false);
  assert.equal(cfg.coachLlmRequired, true);
  assert.equal(cfg.openAiKeyPresent, true);
});
