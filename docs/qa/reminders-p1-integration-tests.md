# Reminders P1 Integration Tests

## Scope
Covers REL-001, REL-002, and validation polish for reminders:

1. Retry scheduling on outbound failure with deterministic backoff.
2. Eventual `sent` state on later successful send.
3. Duplicate Twilio status callback handling (idempotent transition behavior).
4. Invalid `dueAtIso` returns `400`.

## Run
From repo root:

```bash
npm install
cp .env.example .env
docker compose up -d
npm run test:api:integration
```

## Expected output
- Test runner shows **4 passing** tests in `apps/api/src/tests/reminders.integration.test.ts`.
- No flaky timing loops: retry test checks the first backoff window (~1 minute) with tolerant bounds.

## Notes
- Tests use real Postgres state and truncate `reminders` and `message_events` between cases.
- Twilio signature verification is disabled for test runs via the npm test script environment (`TWILIO_VERIFY_SIGNATURE=false`) so callback tests can run locally without signature setup.
