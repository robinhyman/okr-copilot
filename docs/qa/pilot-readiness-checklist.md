# OKR Copilot — Pilot Readiness Checklist

Date: 2026-02-25  
Owner: QA

## Scope
Pilot-readiness verification for:
1. Requeue on failed reminders
2. Migration-only startup path (no runtime table bootstrap)
3. UI behavior for:
   - draft source badge
   - save/check-in feedback
   - check-in history visibility

---

## Quick status snapshot (as of this checklist)
- ✅ **Reminder requeue behavior** is implemented and has integration test coverage.
- ✅ **Migration-only startup path** is implemented (`runMigrations()` at startup, legacy `ensure*Table` helpers are no-op).
- ⚠️ **UI save/check-in feedback** exists (status text updates).
- ❌ **UI draft source badge** not currently rendered.
- ❌ **UI check-in history** not currently rendered.

Result: **Pilot readiness is pending UI completion** for source badge + history.

---

## Local verification commands (copy/paste)

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot

# 1) Environment + infra
cp -n .env.example .env
docker compose up -d
npm install

# 2) Schema via migrations
npm run migrate

# 3) Run API integration tests (includes reminder requeue/idempotency)
npm run test:api:integration

# 4) Run API + Web for manual UI checks
npm run dev
# API: http://localhost:4000
# Web: http://localhost:5173
```

---

## Verification checklist

### A) Requeue failed reminders (required)

#### Automated gate (primary)
- [ ] `npm run test:api:integration` passes
- [ ] Confirm these reminder tests pass:
  - `retry scheduling on failure uses deterministic backoff`
  - `eventual sent state on success after a retry`
  - `duplicate status callback handling is idempotent`

#### Manual spot check (optional but recommended)
```bash
# create due reminder
curl -sS -X POST http://localhost:4000/api/reminders \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"recipient":"whatsapp:+447000000009","message":"requeue probe","dueAtIso":"2026-02-25T12:00:00Z"}'

# run due cycle once
curl -sS -X POST http://localhost:4000/api/reminders/run-due \
  -H 'x-auth-stub-token: dev-stub-token'

# inspect latest reminders
curl -sS 'http://localhost:4000/api/reminders?limit=20' | jq
```

Pass condition:
- After simulated/real failure, reminder transitions to `retry_scheduled` with `next_attempt_at` populated.
- On later success, reminder transitions to `sent`.

---

### B) Migration-only startup path (required)

```bash
# startup path check
sed -n '1,140p' apps/api/src/index.ts

# ensure legacy table-bootstrap helpers are no-op
sed -n '1,90p' apps/api/src/data/reminders-repo.ts
sed -n '1,70p' apps/api/src/data/message-events-repo.ts

# ensure no runtime callsites for ensure*Table
grep -RIn "ensureRemindersTable\|ensureMessageEventsTable" apps/api/src
```

Pass condition:
- `runMigrations()` is executed during startup.
- No active runtime schema bootstrap SQL exists in repositories.
- No runtime callsites depend on `ensure*Table` behavior.

---

### C) UI checks (required)

#### C1) Draft source badge
Manual flow:
1. Open web app (`/`).
2. Generate draft.
3. Verify a visible badge/label indicates draft source (e.g., `LLM` or `Fallback`).

Pass condition:
- User can clearly see draft source on screen after generation.

Current status: **FAIL (pending engineering)**.

#### C2) Save/check-in feedback
Manual flow:
1. Generate draft and click **Save OKR**.
2. Submit one KR check-in.
3. Observe feedback states/messages.

Pass condition:
- Save action gives immediate, unambiguous success/error feedback.
- Check-in action gives immediate, unambiguous success/error feedback.

Current status: **PASS (status line messages exist)**.

#### C3) Check-in history
Manual flow:
1. Submit at least 2 check-ins for same KR.
2. Refresh UI.
3. Verify historical entries are visible (value, commentary, timestamp at minimum).

Pass condition:
- History is visible and persists across refresh.

Current status: **FAIL (pending engineering)**.

---

## Concise pass/fail rubric

- **PASS (Pilot Ready):**
  - A ✅ Reminder requeue checks pass
  - B ✅ Migration-only startup checks pass
  - C1 ✅ Draft source badge visible
  - C2 ✅ Save/check-in feedback clear
  - C3 ✅ Check-in history visible

- **FAIL (Not Pilot Ready):**
  - Any required item above fails.

Current rubric result: **FAIL (C1, C3 pending)**.

---

## Pending checklist (exact post-merge checks)

Run this after engineering merges UI changes for draft source badge + check-in history.

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot

# pull latest and verify target changes landed
git log --oneline -n 20

# run full local gate
docker compose up -d
npm install
npm run migrate
npm run test:api:integration
npm run dev
```

Post-merge manual assertions:
- [ ] Generate draft -> source badge is visible and correct for both key-present and key-missing scenarios.
- [ ] Save OKR -> success/error feedback appears and is understandable.
- [ ] Submit KR check-in -> success/error feedback appears and is understandable.
- [ ] Submit 2+ check-ins for same KR -> history renders with prior entries after refresh.

Optional API-level source check:
```bash
# key-missing fallback metadata
OPENAI_API_KEY= curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Client delivery","timeframe":"Q2 2026"}' | jq '.metadata'
```

Expected:
- `metadata.source` present (`fallback` or `llm`) and UI badge reflects this source.
