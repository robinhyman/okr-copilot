import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverviewSummary } from './OverviewSummary';
import { buildGroupedOverviewMetrics, buildOverviewMetrics } from '../lib/overviewMetrics';

test('OverviewSummary renders empty state when no KRs', () => {
  const html = renderToStaticMarkup(createElement(OverviewSummary, { metrics: buildOverviewMetrics([]) }));
  assert.match(html, /No key results yet/);
});

test('OverviewSummary renders status blocks and at-risk items', () => {
  const metrics = buildOverviewMetrics([
    { id: 1, title: 'Healthy KR', currentValue: 90, targetValue: 100, unit: '%' },
    { id: 2, title: 'Risky KR', currentValue: 30, targetValue: 100, unit: '%' },
    { id: 3, title: 'Needs attention KR', currentValue: 50, targetValue: 100, unit: '%' }
  ]);

  const html = renderToStaticMarkup(createElement(OverviewSummary, { metrics }));
  assert.match(html, /Overall progress/);
  assert.match(html, /KR status distribution/);
  assert.match(html, /Top at-risk KRs/);
  assert.match(html, /Risky KR/);
});


test('OverviewSummary renders grouped objective sections with objective and KR graphics', () => {
  const metrics = buildGroupedOverviewMetrics([
    {
      id: 1,
      objective: 'Grow pipeline',
      timeframe: 'Q2',
      teamId: 'team_sales',
      teamName: 'Sales Team',
      ownerLabel: 'Owner: VP Sales',
      keyResults: [
        { id: 11, title: 'Book intros', currentValue: 3, targetValue: 10, unit: 'calls' },
        { id: 12, title: 'Ship proposals', currentValue: 5, targetValue: 10, unit: 'proposals' }
      ]
    },
    {
      id: 2,
      objective: 'Retention',
      timeframe: 'Q2',
      teamId: 'team_product',
      teamName: 'Product Team',
      ownerLabel: 'Owner: VP Product',
      keyResults: [{ id: 21, title: 'NPS', currentValue: 40, targetValue: 50, unit: 'score' }]
    }
  ]);

  const html = renderToStaticMarkup(createElement(OverviewSummary, {
    metrics,
    role: 'senior_leader',
    selectedTeamId: 'team_sales'
  }));
  assert.match(html, /Sales Team/);
  assert.match(html, /Owner: VP Sales/);
  assert.doesNotMatch(html, /Owner: VP Product/);
  assert.match(html, /Showing objectives for Sales Team/);
  assert.match(html, /Reset team filter/);
  assert.match(html, /Grow pipeline/);
  assert.match(html, /Book intros/);
  assert.doesNotMatch(html, /Retention/);
  assert.match(html, /data-testid="objective-progress-1"/);
  assert.doesNotMatch(html, /data-testid="objective-progress-2"/);
  assert.match(html, /data-testid="kr-progress-1-11"/);
  assert.match(html, /data-testid="kr-progress-1-12"/);
  assert.doesNotMatch(html, /data-testid="kr-progress-2-21"/);
});

test('OverviewSummary manager view ignores selected team filter', () => {
  const metrics = buildGroupedOverviewMetrics([
    {
      id: 1,
      objective: 'Grow pipeline',
      timeframe: 'Q2',
      teamId: 'team_sales',
      teamName: 'Sales Team',
      ownerLabel: 'Owner: VP Sales',
      keyResults: [{ id: 11, title: 'Book intros', currentValue: 3, targetValue: 10, unit: 'calls' }]
    },
    {
      id: 2,
      objective: 'Retention',
      timeframe: 'Q2',
      teamId: 'team_product',
      teamName: 'Product Team',
      ownerLabel: 'Owner: VP Product',
      keyResults: [{ id: 21, title: 'NPS', currentValue: 40, targetValue: 50, unit: 'score' }]
    }
  ]);

  const html = renderToStaticMarkup(createElement(OverviewSummary, {
    metrics,
    role: 'manager',
    selectedTeamId: 'team_sales'
  }));

  assert.match(html, /Grow pipeline/);
  assert.match(html, /Retention/);
  assert.doesNotMatch(html, /Showing objectives for Sales Team/);
});
