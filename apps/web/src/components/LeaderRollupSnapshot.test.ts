import test from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LeaderRollupSnapshot } from './LeaderRollupSnapshot';

test('LeaderRollupSnapshot renders donut and team segment tooltips with count and percent', () => {
  const rollup = {
    teams: [
      { teamId: 'team_alpha', onTrack: 6, atRisk: 3, offTrack: 1 },
      { teamId: 'team_beta', onTrack: 2, atRisk: 2, offTrack: 1 }
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

  assert.match(html, /title="ALPHA • On track: 6 KRs \(60%\)"/);
  assert.match(html, /title="ALPHA • At risk: 3 KRs \(30%\)"/);
  assert.match(html, /title="ALPHA • Off track: 1 KRs \(10%\)"/);

  assert.match(html, /title="BETA • On track: 2 KRs \(40%\)"/);
  assert.match(html, /title="BETA • At risk: 2 KRs \(40%\)"/);
  assert.match(html, /title="BETA • Off track: 1 KRs \(20%\)"/);
});
