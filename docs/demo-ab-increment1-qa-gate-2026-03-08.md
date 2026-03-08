# QA + Release Gate Note — Increment 1 (A/B Create Entry)

Date: 2026-03-08 (final rerun)
Owner: QA/Release Gate
Spec: `docs/spec-ab-experiment-2026-03-08.md`

## Gate decision

**GO**

## Final evidence snapshot

### Mandatory command checks
- `npm run typecheck` ✅
- `npm run build` ✅
- `npm run test` ✅
- `npm run demo:prepare` ✅
- `npm run release:gate` ✅ (`RELEASE_GATE: PASS`)

### Integration + UI tests
- API integration suite: ✅ pass (includes experiment assignment, telemetry ingest, RBAC, coach flows)
- Web test suite: ✅ pass

### Demo-readiness hard gates
- Seeded demo data: ✅ non-empty
  - OKRs=2
  - KRs=6
  - check-ins present
- Manager digest populated: ✅
- Leader rollup populated: ✅

### Experiment-specific acceptance checks
- Assignment determinism/stickiness: ✅
- Allocation sanity check (>=200 synthetic users): ✅ balanced within expected band
- Instrumentation ingest path (`POST /api/events/product`): ✅ implemented and tested
- Required experiment dimensions completeness test: ✅

## Notes
- Earlier NO-GO runs were due to infra/data-state instability during reruns.
- Final rerun completed cleanly and satisfies strict release gate criteria.
