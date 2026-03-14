import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createOkrDraftProvider } from '../services/ai/okr-draft-provider.js';

test('continueConversation escalates to assumption synthesis after repeated discovery turns', async () => {
  const provider = createOkrDraftProvider();

  const messages = [
    { role: 'user' as const, content: 'I need an OKR for onboarding quality.' },
    { role: 'assistant' as const, content: 'What baseline metric and target do you want?' },
    { role: 'user' as const, content: 'Not sure yet. It should improve a lot this quarter.' },
    { role: 'assistant' as const, content: 'What baseline metric and target do you want?' },
    { role: 'user' as const, content: 'Can you just draft now with assumptions?' }
  ];

  const result = await provider.continueConversation({
    messages,
    timeframe: 'Q2 2026'
  });

  assert.equal(result.mode, 'refine');
  assert.equal(result.metadata.loopDetected, true);
  assert.equal(result.metadata.loopEscapePath, 'assumption_synthesis');
  assert.equal(result.metadata.draftOnRequestCompliant, true);
  assert.ok(result.assistantMessage.toLowerCase().includes('assumption'));
});

test('loop escape copy no longer uses A/B/C robotic menu wording', () => {
  const providerPath = path.resolve(process.cwd(), 'src/services/ai/okr-draft-provider.ts');
  const providerSource = fs.readFileSync(providerPath, 'utf8');

  assert.ok(!providerSource.includes('Choose one: A) quick estimate B) exact metric C) draft with assumptions now.'));
  assert.ok(providerSource.includes('share a quick estimate, give the exact metric, or I can draft now with clear assumptions'));
});
