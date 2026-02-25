# OKR Copilot — MVP Loop 1 QA Test Pack

Date: 2026-02-25  
Owner: QA (MVP Loop 1)

## 1) Scope
This pack covers MVP Loop 1 functional QA for:
1. OKR draft generation
2. Edit/save OKRs
3. KR check-in with value + commentary

It also includes clone-and-run setup, expected outputs, pass/fail rubric, and regression checks for previously hardened security controls.

---

## 2) Current implementation status (important)
**Engineering output for MVP Loop 1 feature flows is not yet present** in current `main` workspace snapshot.

Observed evidence:
- Web app is still starter shell (`apps/web/src/App.tsx`) with TODO to replace with real OKR draft/editor flow.
- API currently exposes reminders/WhatsApp pipeline + defaults/auth/health routes, but no implemented OKR draft/edit/check-in endpoints.
- Excel KR adapter remains placeholder (`apps/api/src/services/adapters/excel-kr.adapter.ts`).

Because of this, Loop 1 feature test cases below are split into:
- **A) Ready-now baseline & security regression checks** (can run now)
- **B) Pending post-merge feature checks** (run immediately after Loop 1 engineering merge)

---

## 3) Clone-and-run instructions

### 3.1 Prerequisites
- Git 2.30+
- Node.js 22.x
- npm 10+
- Docker Engine + Docker Compose plugin
- Free ports: 4000, 5173, 5432, 6379

Verify:
```bash
git --version
node -v
npm -v
docker --version
docker compose version
```

### 3.2 Clone + install
```bash
git clone <REPO_URL> okr-copilot
cd okr-copilot
npm ci
```

### 3.3 Environment + infra
```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Expected:
- Postgres and Redis containers are `Up (healthy)`.

### 3.4 Baseline quality gates
```bash
npm run typecheck
npm run build
npm test
```

### 3.5 Start services
```bash
# terminal 1
npm run dev -w @okr-copilot/api

# terminal 2 (optional web)
npm run dev -w @okr-copilot/web
```

Smoke checks:
```bash
curl -sS http://localhost:4000/health
curl -sS http://localhost:4000/modules
curl -sS http://localhost:4000/auth/status
```

---

## 4) Verified now (QA evidence from this run)
Executed on current workspace snapshot:
- ✅ `npm run typecheck` passed
- ✅ `npm run build` passed
- ✅ `npm test` passed
  - API integration tests: **4 passed / 0 failed**
  - Web tests: **0 tests**

Interpretation:
- Platform baseline and reminders pipeline are healthy.
- Loop 1 OKR feature behavior is still pending implementation.

---

## 5) MVP Loop 1 functional test cases (post-merge)

> Replace endpoint/UI selectors once engineering PR finalizes exact contract.

### TC-DRAFT-001 — Generate initial OKR draft
**Goal:** User can create an OKR draft from input context.

Preconditions:
- API + web running
- Auth token/header available
- Seed workspace/user exists (or setup endpoint available)

Steps:
1. Open Loop 1 draft screen (or call draft endpoint).
2. Provide required prompt/context fields.
3. Trigger “Generate draft”.
4. Capture response payload and UI render.

Expected output:
- HTTP `200`/`201` (or equivalent UI success state).
- Draft includes at minimum:
  - objective text
  - at least one key result
  - identifiable draft/workspace/user IDs
  - timestamps/version metadata
- No empty/null required fields.

Pass:
- Draft is returned/rendered and persisted retrievably.

Fail:
- 4xx/5xx without validation reason, malformed draft shape, or non-persistent result.

---

### TC-DRAFT-002 — Draft validation errors
**Goal:** Invalid/missing inputs are rejected cleanly.

Steps:
1. Submit draft request with missing required fields.
2. Submit with invalid types/lengths (e.g., empty objective, invalid KR structure).

Expected output:
- HTTP `400` with deterministic error code(s).
- No partial write for invalid requests.

Pass:
- Validation is explicit and consistent.

Fail:
- Silent acceptance, generic 500, or partial/dirty writes.

---

### TC-EDIT-001 — Edit existing OKR and save
**Goal:** User can edit objective/KRs and persist updates.

Steps:
1. Load an existing draft/OKR.
2. Edit objective text.
3. Edit KR fields (name/target/unit as applicable).
4. Save.
5. Reload from read endpoint/UI refresh.

Expected output:
- Save response success (`200`/`204`).
- Persisted record reflects updated fields.
- Version/update timestamp increments.

Pass:
- Data remains consistent after reload and restart.

Fail:
- Save appears successful but stale data returns, or unintended fields mutate.

---

### TC-EDIT-002 — Concurrency/version guard
**Goal:** Conflicting edits are handled safely.

Steps:
1. Open same OKR in two sessions.
2. Save from session A.
3. Save stale version from session B.

Expected output:
- Conflict handling (e.g., `409` or explicit stale version message).
- No silent overwrite unless spec explicitly allows last-write-wins.

Pass:
- Behavior matches declared contract and protects integrity.

Fail:
- Undetected destructive overwrite.

---

### TC-CHECKIN-001 — KR check-in with numeric value + commentary
**Goal:** User records KR progress with both value and narrative commentary.

Steps:
1. Select KR.
2. Enter new check-in numeric value.
3. Enter commentary text.
4. Submit check-in.
5. Reload KR timeline/history.

Expected output:
- Success response with check-in ID/timestamp.
- Stored record includes:
  - KR ID
  - numeric value
  - commentary text
  - actor/user ID
  - created timestamp
- KR current value/derived progress updates per rules.

Pass:
- Both value + commentary persist and render in history.

Fail:
- One field dropped, incorrect progress math, or missing audit metadata.

---

### TC-CHECKIN-002 — Check-in validation boundaries
**Goal:** Invalid check-ins rejected; valid edge cases accepted.

Cases:
- Missing value
- Non-numeric value
- Commentary empty (if required)
- Commentary over max length
- Negative/out-of-range values (as per KR type)

Expected output:
- Deterministic `400` errors with field-level details.
- No invalid writes.

---

## 6) Security hardening regression checks (must pass)
These protect prior wave controls and should run on every Loop 1 release.

### SEC-REG-001 — Mutating auth guard
```bash
# no token (expected 401)
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:4000/api/reminders/run-due

# with stub token (expected 200)
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:4000/api/reminders/run-due \
  -H 'x-auth-stub-token: dev-stub-token'
```

### SEC-REG-002 — `/health` secret redaction
```bash
curl -sS http://localhost:4000/health
```
Expected:
- Dependency section reports non-secret status/config booleans only.
- No raw DSN/password/token values in response.

### SEC-REG-003 — Webhook signature strict mode
```bash
# ensure in .env: TWILIO_VERIFY_SIGNATURE=true
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:4000/api/reminders/whatsapp/inbound \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'From=whatsapp:+10000000000&Body=hello&MessageSid=SM_TEST'
```
Expected:
- Missing/invalid signature rejected with `403`.

### SEC-REG-004 — send-test endpoint rate limiting
```bash
for i in {1..12}; do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:4000/api/reminders/whatsapp/send-test \
    -H 'Content-Type: application/json' \
    -H 'x-auth-stub-token: dev-stub-token' \
    -d '{"to":"whatsapp:+10000000000","message":"rl-test"}'
done
```
Expected:
- At least one `429` after threshold.
- `Retry-After` header present on limited responses.

---

## 7) Pass/fail rubric (Loop 1 signoff)

### PASS (release-ready)
- Clone-and-run baseline all green.
- TC-DRAFT/TC-EDIT/TC-CHECKIN all pass.
- Security regressions SEC-REG-001..004 pass.
- No P1/P0 defects open.

### CONDITIONAL PASS
- Core flows pass, but minor non-blocking UX/docs defects remain with agreed fix plan.

### FAIL
- Any core flow broken (draft, edit/save, check-in value+commentary).
- Any security regression fails.
- Data integrity issue (lost writes, unauthorized mutation, malformed persisted records).

---

## 8) Pending checklist + exact commands to run after merge

1. Pull merged Loop 1 branch and install:
```bash
git fetch --all
git checkout <merged_branch_or_main>
git pull --ff-only
npm ci
```

2. Start infra + services:
```bash
cp -n .env.example .env
docker compose up -d
npm run dev -w @okr-copilot/api
```

3. Run full baseline gates:
```bash
npm run typecheck
npm run build
npm test
```

4. Run Loop 1 feature checks (replace placeholders with final endpoints):
```bash
# Draft generation
curl -sS -X POST http://localhost:4000/api/okrs/drafts \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"workspaceId":"ws_qa","prompt":"Q2 growth focus"}'

# Edit/save OKR
curl -sS -X PATCH http://localhost:4000/api/okrs/<OKR_ID> \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"objective":"Updated objective","keyResults":[{"id":"kr1","targetValue":25}]}'

# KR check-in value + commentary
curl -sS -X POST http://localhost:4000/api/key-results/<KR_ID>/checkins \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"value":12,"commentary":"Progress after campaign launch"}'
```

5. Run mandatory security regression block:
- Execute SEC-REG-001..004 commands above.

6. Archive evidence:
- Save terminal output + request/response samples + defect list to `docs/qa/`.

---

## 9) QA recommendation (current snapshot)
- **Status now:** Not ready for Loop 1 functional signoff (feature flows not merged yet).
- **Status now for baseline platform/security:** Runnable with passing baseline checks.
- **Next action:** Execute Section 8 immediately after engineering merge and mark each test case PASS/FAIL with evidence.