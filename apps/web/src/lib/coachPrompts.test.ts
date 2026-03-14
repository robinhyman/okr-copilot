import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCoachPromptChips } from './coachPrompts';

test('buildCoachPromptChips keeps concise shortcuts only', () => {
  const chips = buildCoachPromptChips({
    assistantMessage: 'What baseline metric are you using now?',
    questions: [
      'What baseline metric are you using now?',
      'Use estimate',
      'Draft now with assumptions',
      'I can include your constraints, baseline, and target if you share those now'
    ]
  });

  assert.deepEqual(chips.sort(), ['Draft now with assumptions', 'Use estimate'].sort());
});
