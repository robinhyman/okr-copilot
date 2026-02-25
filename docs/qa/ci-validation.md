# CI validation baseline

This project includes a lightweight GitHub Actions workflow at `.github/workflows/ci.yml`.

## What CI checks

On every pull request and push to `main`, CI runs on `ubuntu-latest` and performs:

1. **Dependency install** via `npm ci`
2. **Type checking** via `npm run typecheck` (workspace-wide)
3. **Build validation** via `npm run build` (workspace-wide)
4. **API integration tests** via `npm run test:api:integration`

The integration test job starts required service containers:

- **Postgres 16** (`localhost:5432`)
- **Redis 7** (`localhost:6379`)

## Required runtime config in CI

The workflow sets defaults needed by API integration tests:

- `DATABASE_URL=postgresql://okr:okr@localhost:5432/okr_copilot?schema=public`
- `REDIS_URL=redis://localhost:6379`
- `AUTH_STUB_ENABLED=true`
- `AUTH_STUB_TOKEN=dev-stub-token`
- `TWILIO_VERIFY_SIGNATURE=false`
- `REMINDER_WORKER_ENABLED=false`

No external secrets are required for this baseline validation workflow.

## Common failure modes

- **Service health/startup failures**
  - Symptoms: connection errors to Postgres/Redis, migration or test setup failures.
  - Fixes: confirm service health checks, port bindings, and connection env vars.

- **Typecheck failures**
  - Symptoms: `tsc --noEmit` errors in `api` or `web` workspace.
  - Fixes: align types/interfaces, ensure strict null/shape compatibility.

- **Build failures**
  - Symptoms: TypeScript compilation or Vite build errors.
  - Fixes: resolve compile-time errors, missing exports/imports, build-time config issues.

- **Integration test regressions**
  - Symptoms: failing API tests in `apps/api/src/tests`.
  - Fixes: check migration compatibility, endpoint contract changes, and auth stub headers.

## Local validation before pushing

Use this sequence locally to mirror CI intent:

```bash
npm ci
npm run typecheck
npm run build
npm run test:api:integration
```

If integration tests fail locally, confirm Postgres and Redis are running and that env vars match CI defaults.
