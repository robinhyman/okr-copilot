# Demo Note — A/B Default-Mode Experiment Increment 1 (Backend/API)

Date: 2026-03-08

References:
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`
- `docs/spec-ab-experiment-2026-03-08.md`
- `docs/architecture-ab-experiment-2026-03-08.md`

## What changed

Implemented additive backend support for default-mode experiment assignment + stickiness + config endpoint:

1. **DB migration**
   - Added `apps/api/migrations/007_default_mode_experiment_assignments.sql`
   - New table: `experiment_assignments`
   - Sticky key: `(experiment_key, user_id, team_id)` unique
   - Variant values: `wizard_first`, `conversational_first`, `not_enrolled`

2. **Experiment assignment service**
   - Added `apps/api/src/data/experiments-repo.ts`
   - Server-side deterministic hashing on `experimentKey:userId:teamId`
   - Supports:
     - global enable/disable
     - traffic percentage
     - weighted split
     - per-variant kill switches
     - optional QA override via header/query (when allowed)
   - Persists first assignment and reuses it for stickiness

3. **API endpoint**
   - Added `GET /api/experiments/default-mode` in `apps/api/src/routes/okrs.ts`
   - Requires auth middleware already used by OKR APIs
   - Response shape (additive):
     - `ok`
     - `experimentKey`
     - `enabled`
     - `variant`
     - `defaultMode`
     - `sticky`
     - `reason`

4. **Docs list update**
   - Added endpoint in API root docs list (`apps/api/src/app.ts`)

5. **Tests**
   - Updated reset fixture to truncate `experiment_assignments`
   - Added integration tests in `apps/api/src/tests/okrs.integration.test.ts` for:
     - sticky determinism across repeated calls for same user/team
     - API response shape and forced-off behavior

## Backward compatibility

- Existing OKR/draft/check-in routes unchanged.
- New behavior is additive via new endpoint + new table.
- Experiment defaults to off unless explicitly enabled through env.

## Commands run + results

1. `npm run typecheck -w @okr-copilot/api`
   - ✅ Passed

2. `npm run build -w @okr-copilot/api`
   - ✅ Passed

3. `npm run test:integration -w @okr-copilot/api`
   - ❌ Failed in this environment with `ECONNREFUSED` to Postgres during test hooks/migrations (pre-existing infra dependency issue), so integration assertions could not be executed locally end-to-end.

## Open issues / blockers

1. **Local integration-test infra blocker**
   - Postgres is unreachable in this subagent runtime (`ECONNREFUSED`), preventing integration-suite execution.

2. **Increment-1 scope intentionally limited**
   - No UI routing changes or telemetry event emission were added in this backend-only increment.
   - Variant exposure/flow analytics persistence remains for next increment.
