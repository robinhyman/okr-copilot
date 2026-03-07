import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGeneratedDraft, buildWizardBaselineText, getPreSaveQualityWarnings } from './wizard';

test('buildWizardBaselineText prefers structured baseline when present', () => {
  const baseline = buildWizardBaselineText({
    baseline: 'legacy baseline text',
    baselineValue: '12',
    baselineUnit: 'deliverables',
    baselinePeriod: 'month'
  });

  assert.equal(baseline, 'Current baseline is 12 deliverables per month');
});

test('getPreSaveQualityWarnings returns non-blocking KR quality heuristics', () => {
  const warnings = getPreSaveQualityWarnings({
    objectives: [
      {
        keyResults: [{ title: 'Improve onboarding', unit: 'points' }]
      }
    ]
  });

  assert.ok(warnings.length > 0);
  assert.ok(warnings.some((w) => w.includes('title looks vague')));
  assert.ok(warnings.some((w) => w.includes('unit is generic')));
});

test('applyGeneratedDraft supports replace and append modes', () => {
  const existing = [{
    objective: 'Existing objective',
    timeframe: 'Q2 2026',
    keyResults: [{ title: 'Increase X from 1 to 2', currentValue: 1, targetValue: 2, unit: 'points' }]
  }];

  const generated = {
    objective: 'New objective',
    timeframe: 'Q2 2026',
    keyResults: [{ title: 'Increase Y from 2 to 3', currentValue: 2, targetValue: 3, unit: 'points' }]
  };

  const replaced = applyGeneratedDraft(existing, generated, 'replace', 5);
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].objective, 'New objective');

  const appended = applyGeneratedDraft(existing, generated, 'append', 5);
  assert.equal(appended.length, 2);
  assert.equal(appended[0].objective, 'Existing objective');
  assert.equal(appended[1].objective, 'New objective');
});
