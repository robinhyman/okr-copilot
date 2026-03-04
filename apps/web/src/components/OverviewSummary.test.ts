import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { OverviewSummary } from './OverviewSummary';
import { buildOverviewMetrics } from '../lib/overviewMetrics';

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
