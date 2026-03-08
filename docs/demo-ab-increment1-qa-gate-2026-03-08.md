# QA + Release Gate Note — Increment 1 (A/B Create Entry) — Re-run

Date: 2026-03-08 (rerun)
Owner: QA/Release Gate
Spec: `docs/spec-ab-experiment-2026-03-08.md`
Evidence refs:
- `docs/demo-ab-increment1-backend-2026-03-08.md`
- `docs/demo-ab-increment1-ui-2026-03-08.md`

## Gate decision

**NO-GO**

## Blocking reasons (explicit)

1. **Mandatory API integration gate is still failing in this environment**
   - `npm run test:api:integration` failed: **30 failed / 2 passed**.
   - Common failure mode: `ECONNREFUSED` to Postgres (`127.0.0.1:5432` / `::1:5432`) during migration/test hooks.
   - This blocks verification of assignment stickiness, RBAC, and journey regressions under integration conditions.

2. **Release gate operational checks cannot complete locally**
   - `npm run release:gate` failed.
   - `demo:prepare` checks failed (`migrate`, `api_health`) due to same DB connectivity issue and API startup failure.
   - Therefore demo-readiness hard gates (seed + health path) are not evidenced in this runtime.

3. **Instrumentation acceptance criteria are not fully met end-to-end**
   - UI sends best-effort telemetry to `POST /api/events/product`.
   - No corresponding backend ingest route found in `apps/api/src` for `/api/events/product` in this increment.
   - Required experiment event-set/completeness proof (>=99% successful journeys with mandatory dimensions) cannot be validated.

4. **Several spec ACs remain unproven locally due infra + missing ingest/reporting path**
   - Balanced allocation (>=200 synthetic users, 45/55–55/45), instrumentation completeness, and KPI/report readiness are not validated in this rerun.

---

## Checks run (rerun)

### Deterministic quality checks
- ✅ `npm run typecheck` (workspace)
- ✅ `npm run build` (workspace)
- ✅ `npm run test -w @okr-copilot/web` (20 passed, 0 failed)
- ❌ `npm run test:api:integration` (DB `ECONNREFUSED`; 30 failed, 2 passed)
- ❌ `npm run release:gate` (fails via `demo:prepare` migrate/api_health + API fetch to `127.0.0.1:4000`)

### Local implementation/evidence validation
- ✅ Backend assignment implementation present:
  - `apps/api/migrations/007_default_mode_experiment_assignments.sql`
  - `apps/api/src/data/experiments-repo.ts`
  - `apps/api/src/routes/okrs.ts` (`GET /api/experiments/default-mode`)
- ✅ UI variant-routing/switch UX present:
  - `apps/web/src/App.tsx` default-mode resolver + switch/escape hatch flow
- ⚠️ Telemetry ingest endpoint missing server-side:
  - UI calls `/api/events/product`, but no API route found in `apps/api/src` for that path.

---

## Acceptance criteria matrix (spec)

1. Assignment determinism — **PARTIAL**
   - Code + integration test coverage exist, but integration suite cannot execute due DB outage.
2. Balanced allocation (45/55–55/45 over >=200) — **FAIL / NOT EVIDENCED**
3. Default routing by variant — **PARTIAL**
   - UI routing logic implemented; no runnable end-to-end verification in this environment.
4. Flow switch support + context preservation + switch event — **PARTIAL**
   - UI behavior implemented; backend event persistence not evidenced.
5. RBAC preservation — **PARTIAL**
   - RBAC tests exist but cannot run due DB blocker.
6. Instrumentation completeness >=99% + mandatory dimensions — **FAIL / NOT EVIDENCED**
   - No backend ingest path in this increment.
7. AI/fallback metadata continuity — **PARTIAL**
   - UI includes metadata in events; persistence/completeness validation not possible.
8. Experiment controls (flag off, variant kill switch, override) — **PARTIAL**
   - Config + assignment logic implemented; integration verification blocked.
9. Baseline quality gates + persona validation + seeded demo non-empty checks — **FAIL / BLOCKED**
   - Typecheck/build pass; integration + demo prep/seed checks blocked by DB/API startup failure.
10. Evidence artifact produced — **PASS**
   - Backend/UI demo notes exist; this QA gate rerun note now added.

---

## Required fixes to pass gate

1. Restore local/integration infra (Postgres reachable) and re-run:
   - `npm run test:api:integration`
   - `npm run release:gate`
2. Implement backend telemetry ingest (`POST /api/events/product`) and persistence/validation path for experiment events.
3. Provide balanced-allocation and instrumentation-completeness evidence (AC2/AC6), plus seed/demo non-empty verification outputs.
4. Re-run persona/RBAC and flow-switch journeys end-to-end with auditable evidence snippets.

## Retest recommendation

Re-run full gate after infra and telemetry fixes. Current release status remains **NO-GO**.