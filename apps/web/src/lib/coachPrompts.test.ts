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

test('buildCoachPromptChips adds strategic fallbacks when sanitized list is empty', () => {
  const delivery = buildCoachPromptChips({
    assistantMessage: 'What strategic outcomes matter most for delivery speed this quarter?',
    questions: ['What would success look like?', 'How should we measure this?']
  });

  assert.deepEqual(delivery, ['Speed up delivery', 'Improve quality', 'Other focus']);

  const customer = buildCoachPromptChips({
    assistantMessage: 'Which customer pain points should we prioritize?',
    questions: ['Can you share your top risk?', 'How will success be measured?']
  });

  assert.deepEqual(customer, ['Reduce customer issues', 'Improve quality', 'Other focus']);
});

test('buildCoachPromptChips QA matrix across novice contexts', () => {
  const scenarios = [
    {
      name: 'blank-page novice',
      input: {
        questions: [
          'What team is this for?',
          'Use estimate',
          'Draft now with assumptions'
        ]
      },
      expectedContains: ['Use estimate', 'Draft now with assumptions']
    },
    {
      name: 'question-stem heavy prompts',
      input: {
        questions: [
          'How will success be measured?',
          'Which metric matters most?',
          'Can you share baseline?',
          'Share baseline now'
        ]
      },
      expectedContains: ['Share baseline now']
    },
    {
      name: 'long prose trimmed out',
      input: {
        questions: [
          'Please describe your complete strategic context before we continue so I can create a robust draft',
          'Set target range'
        ]
      },
      expectedContains: ['Set target range']
    },
    {
      name: 'pronoun-led candidates filtered',
      input: {
        questions: ['I need help', 'We need guidance', 'Use quick draft']
      },
      expectedContains: ['Use quick draft']
    },
    {
      name: 'question-mark endings removed and valid',
      input: {
        questions: ['Draft now?', 'Set timeframe now?', 'Pick guardrail metric']
      },
      expectedContains: ['Set timeframe now', 'Pick guardrail metric']
    }
  ];

  for (const scenario of scenarios) {
    const chips = buildCoachPromptChips(scenario.input);

    assert.ok(chips.length <= 3, `${scenario.name}: chips should cap at 3`);
    for (const chip of chips) {
      const wordCount = chip.trim().split(/\s+/).length;
      assert.ok(wordCount >= 2 && wordCount <= 5, `${scenario.name}: word-count invalid: ${chip}`);
      assert.equal(/[?]$/.test(chip), false, `${scenario.name}: should not end with ? -> ${chip}`);
      assert.equal(/^(what|how|which)\b/i.test(chip) || /^can\s+you\b/i.test(chip), false, `${scenario.name}: coach question stem leaked: ${chip}`);
    }

    for (const required of scenario.expectedContains) {
      assert.ok(chips.includes(required), `${scenario.name}: expected chip missing: ${required}; got ${chips.join(' | ')}`);
    }
  }
});
