import test from 'node:test';
import assert from 'node:assert/strict';
import { buildGroupedOverviewMetrics, buildOverviewMetrics, classifyKrStatus } from './overviewMetrics';

test('classifyKrStatus applies deterministic thresholds', () => {
  assert.equal(classifyKrStatus(0.8), 'on-track');
  assert.equal(classifyKrStatus(0.55), 'needs-attention');
  assert.equal(classifyKrStatus(0.2), 'off-track');
});

test('buildOverviewMetrics computes aggregate progress and distribution', () => {
  const metrics = buildOverviewMetrics([
    { id: 1, title: 'KR 1', currentValue: 80, targetValue: 100, unit: '%' },
    { id: 2, title: 'KR 2', currentValue: 50, targetValue: 100, unit: '%' },
    { id: 3, title: 'KR 3', currentValue: 10, targetValue: 100, unit: '%' },
    { id: 4, title: 'KR 4', currentValue: 100, targetValue: 100, unit: '%' }
  ]);

  assert.equal(metrics.totalKrs, 4);
  assert.equal(metrics.overallProgressPercent, 60);
  assert.deepEqual(metrics.statusDistribution, {
    'on-track': 2,
    'needs-attention': 1,
    'off-track': 1
  });
  assert.deepEqual(
    metrics.topAtRisk.map((kr) => kr.id),
    [3, 2]
  );
});

test('buildGroupedOverviewMetrics groups KR metrics under objectives', () => {
  const metrics = buildGroupedOverviewMetrics([
    {
      id: 11,
      objective: 'Objective A',
      timeframe: 'Q2',
      keyResults: [
        { id: 1, title: 'A1', currentValue: 50, targetValue: 100, unit: '%' },
        { id: 2, title: 'A2', currentValue: 100, targetValue: 100, unit: '%' }
      ]
    },
    {
      id: 22,
      objective: 'Objective B',
      timeframe: 'Q2',
      keyResults: [{ id: 3, title: 'B1', currentValue: 20, targetValue: 100, unit: '%' }]
    }
  ]);

  assert.equal(metrics.byObjective.length, 2);
  assert.equal(metrics.byObjective[0].progressPercent, 75);
  assert.equal(metrics.byObjective[1].progressPercent, 20);
  assert.equal(metrics.totalKrs, 3);
});

test('buildOverviewMetrics handles empty and invalid targets', () => {
  const empty = buildOverviewMetrics([]);
  assert.equal(empty.totalKrs, 0);
  assert.equal(empty.overallProgressPercent, 0);

  const invalidTarget = buildOverviewMetrics([{ id: 1, title: 'KR bad', currentValue: 10, targetValue: 0, unit: 'x' }]);
  assert.equal(invalidTarget.metricsByKr[0].progressPercent, 0);
  assert.equal(invalidTarget.metricsByKr[0].status, 'off-track');
});
