import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverviewDashboard } from './OverviewDashboard';

const metrics = {
  totalKrs: 3,
  overallProgressPercent: 54,
  statusDistribution: { 'on-track': 1, 'needs-attention': 1, 'off-track': 1 },
  topAtRisk: [
    { id: 11, title: 'Reduce churn', unit: '%', currentValue: 2, targetValue: 5, progressRatio: 0.4, progressPercent: 40, gapToTarget: 3, status: 'needs-attention' as const }
  ],
  metricsByKr: [],
  byObjective: [
    {
      id: 1,
      objective: 'Improve retention',
      timeframe: 'Q2',
      progressPercent: 54,
      keyResults: [
        { id: 11, title: 'Reduce churn', unit: '%', currentValue: 2, targetValue: 5, progressRatio: 0.4, progressPercent: 40, gapToTarget: 3, status: 'needs-attention' as const }
      ]
    }
  ]
};

test('leader overview renders graphical rollup and trend card', () => {
  const html = renderToStaticMarkup(
    createElement(OverviewDashboard, {
      role: 'senior_leader',
      metrics,
      managerDigest: null,
      leaderRollup: {
        teams: [{ teamId: 'team_product', onTrack: 4, atRisk: 2, offTrack: 1 }],
        trend: [
          { weekStart: '2026-02-10', onTrack: 3, atRisk: 2, offTrack: 2 },
          { weekStart: '2026-02-17', onTrack: 4, atRisk: 2, offTrack: 1 }
        ]
      }
    })
  );

  assert.match(html, /Senior leader rollup snapshot/);
  assert.match(html, /Team health mix/);
  assert.match(html, /4-week trend/);
});

test('manager overview renders baseline cards and digest', () => {
  const html = renderToStaticMarkup(
    createElement(OverviewDashboard, {
      role: 'manager',
      metrics,
      managerDigest: {
        teamId: 'team_product',
        summary: { on_track: 2, at_risk: 1, off_track: 0 },
        items: [{ keyResultId: 11, title: 'Reduce churn', objective: 'Improve retention', riskLevel: 'at_risk', staleDays: 2, note: null, reasonCodes: ['negative_progress_delta'], riskScore: 47 }]
      },
      leaderRollup: null
    })
  );

  assert.match(html, /Overall progress/);
  assert.match(html, /KR status distribution/);
  assert.match(html, /Objectives/);
  assert.match(html, /Manager action digest/);
  assert.match(html, /Quality:/);
  assert.match(html, /Next action:/);
  assert.match(html, /risk 47/);
  assert.match(html, /Hide details/);
  assert.match(html, /Nudge owner/);
});
