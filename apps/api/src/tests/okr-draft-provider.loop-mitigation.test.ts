import test from 'node:test';
import assert from 'node:assert/strict';
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
