import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderRollupSnapshot } from './LeaderRollupSnapshot';

test('LeaderRollupSnapshot renders donut and team segment tooltips with count and percent', () => {
  const rollup = {
    teams: [
      { teamId: 'team_product', teamDisplayName: 'Product Team', ownerDisplayName: 'VP Product', onTrack: 6, atRisk: 3, offTrack: 1 },
      { teamId: 'team_sales', teamDisplayName: 'Sales Team', ownerDisplayName: 'VP Sales', onTrack: 2, atRisk: 2, offTrack: 1 }
    ],
    trend: [
      { weekStart: '2026-02-10', onTrack: 5, atRisk: 3, offTrack: 2 },
      { weekStart: '2026-02-17', onTrack: 6, atRisk: 2, offTrack: 2 },
      { weekStart: '2026-02-24', onTrack: 7, atRisk: 2, offTrack: 1 },
      { weekStart: '2026-03-03', onTrack: 8, atRisk: 1, offTrack: 1 }
    ]
  };

  const html = renderToStaticMarkup(createElement(LeaderRollupSnapshot, { rollup }));

  assert.match(html, /<title>On track: 8 KRs \(53%\)<\/title>/);
  assert.match(html, /<title>At risk: 5 KRs \(33%\)<\/title>/);
  assert.match(html, /<title>Off track: 2 KRs \(13%\)<\/title>/);

  assert.match(html, /Product Team/);
  assert.match(html, /Owner: VP Product/);
  assert.match(html, /title="Product Team • On track: 6 KRs \(60%\)"/);

  assert.match(html, /Sales Team/);
  assert.match(html, /Owner: VP Sales/);
  assert.match(html, /title="Sales Team • Off track: 1 KRs \(20%\)"/);

  assert.match(html, /Needs attention now/);
});
