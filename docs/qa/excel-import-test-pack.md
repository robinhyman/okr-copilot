# OKR Copilot — Excel Import QA Test Pack

Date: 2026-02-26  
Owner: QA (Excel import wave)

## 1) Scope
This pack defines QA coverage for the Excel import feature wave, with emphasis on:
- upload → preview → apply flow correctness
- workbook schema validation and edge-case handling
- explicit pass/fail signoff criteria
- copy-paste local verification commands
- regression safety for existing OKR + check-in behavior

## 2) Current implementation status (important)
At time of writing, Excel ingestion is **not fully wired end-to-end** in runtime routes/UI.

Observed evidence:
- `apps/api/src/services/adapters/excel-kr.adapter.ts` is still placeholder (`ingestFromPath` returns empty rows + warning).
- No finalized Excel upload/preview/apply API contract is present in currently exposed routes.

Because of this, this pack is structured as:
1. **Ready-now baseline and regression checks** (runnable immediately)
2. **Post-merge Excel import checks** (execute as soon as engineering lands upload/preview/apply)

---

## 3) Test matrix — upload / preview / apply

Legend:
- Priority: P0 (release blocker), P1 (high), P2 (nice-to-have)
- Status now: Ready / Pending engineering merge

| ID | Stage | Scenario | Priority | Preconditions | Expected | Status now |
|---|---|---|---|---|---|---|
| EX-UP-001 | Upload | Valid `.xlsx` accepted | P0 | Auth + import endpoint available | 200/201, file accepted, import session/id returned | Pending |
| EX-UP-002 | Upload | Reject unsupported extension (`.csv`, `.xlsm` if unsupported) | P0 | Same | 400 with deterministic error code | Pending |
| EX-UP-003 | Upload | Reject oversized file (> configured max) | P1 | Max-size configured | 413/400 with size error, no session created | Pending |
| EX-UP-004 | Upload | Missing auth token on mutating endpoint | P0 | Endpoint reachable | 401/403 | Pending |
| EX-PR-001 | Preview | Valid workbook maps rows correctly | P0 | Upload succeeded | Preview returns parsed rows + zero fatal errors | Pending |
| EX-PR-002 | Preview | Unknown/extra columns are ignored or warned per spec | P1 | Workbook includes extra columns | Non-fatal warnings; no crash | Pending |
| EX-PR-003 | Preview | Missing required column(s) | P0 | Workbook missing objective/KR/target etc. | 400 or preview with blocking errors, apply disabled | Pending |
| EX-PR-004 | Preview | Mixed row validity (some valid, some invalid) | P0 | Workbook has mixed quality rows | Per-row errors surfaced with row numbers | Pending |
| EX-PR-005 | Preview | Duplicate KR rows in same file | P1 | Duplicates present | Deterministic dedupe/conflict behavior | Pending |
| EX-PR-006 | Preview | Numeric parse edge cases (blank, text in numeric field, locale commas) | P0 | Edge-case values present | Correct coercion or validation errors | Pending |
| EX-AP-001 | Apply | Apply all valid rows updates KR state | P0 | Clean preview | Success summary: created/updated/skipped/failed counts | Pending |
| EX-AP-002 | Apply | Apply blocked when preview has fatal errors | P0 | Preview has blocking errors | 400/conflict; no partial write unless contract allows | Pending |
| EX-AP-003 | Apply | Idempotency (same preview applied twice) | P1 | First apply completed | Second apply is no-op or deterministic duplicate handling | Pending |
| EX-AP-004 | Apply | Partial failure handling and rollback rules | P0 | Inject one invalid row at apply time | Behavior matches transaction contract (atomic or row-level) | Pending |
| EX-AP-005 | Apply | Audit fields captured (actor/import id/timestamp) | P1 | Successful apply | Audit metadata persisted and retrievable | Pending |
| EX-AP-006 | Apply | Concurrency: two applies against same KR set | P1 | Two sessions | Conflict handling/no silent corruption | Pending |

---

## 4) Sample workbook schema + edge cases

## 4.1 Canonical sheet expectation (proposed QA contract)
Sheet name: `KR Updates` (or first sheet if contract says so)

Required columns (case-insensitive header mapping recommended):
- `objective`
- `key_result`
- `current_value`
- `target_value`
- `updated_at_iso` (optional if backend stamps server time; required only if contract says so)

Optional columns:
- `unit`
- `commentary`
- `owner_email`
- `okr_id`
- `kr_id`

## 4.2 Example rows

| objective | key_result | current_value | target_value | updated_at_iso | unit | commentary |
|---|---|---:|---:|---|---|---|
| Improve client delivery outcomes | Ship weekly updates | 4 | 12 | 2026-02-24T09:00:00Z | updates | Good weekly cadence |
| Improve client delivery outcomes | NPS from delivery touchpoints | 42 | 55 | 2026-02-24T09:00:00Z | score | Early signal improving |

## 4.3 Edge case workbook set (must test)
1. Empty workbook / empty sheet
2. Header typos (`keyresult`, `target value`, etc.)
3. Duplicate headers
4. Missing required headers
5. Trailing/leading spaces in headers and cell values
6. Non-numeric in numeric fields (`"ten"`, `"3,5"`, `""`)
7. Negative values where disallowed
8. `current_value > target_value` (if disallowed by spec)
9. Very long objective/KR text
10. Duplicate KR identifiers across rows
11. Date in multiple formats (ISO, Excel serial, locale date)
12. Unicode characters and emoji in commentary
13. Formula cells returning values/errors
14. Hidden rows/columns
15. Multi-sheet workbook with valid data not in first sheet

---

## 5) Pass / fail criteria

## PASS (release-ready)
- All P0 tests in section 3 pass.
- Upload/preview/apply error responses are deterministic and actionable.
- No data corruption/loss under retry, duplicate apply, or concurrency scenarios.
- Existing OKR/check-in/reminders regression checks pass (section 7).

## CONDITIONAL PASS
- All P0 pass, but P1 non-critical UX/reporting defects remain with documented fixes and no integrity/security risk.

## FAIL
- Any P0 fails.
- Apply path causes silent partial corruption or unauthorized mutation.
- Existing OKR/check-in baseline regresses.

---

## 6) Copy-paste commands for local verification

Run from repo root: `projects/okr-copilot`

### 6.1 Baseline setup
```bash
cp -n .env.example .env
docker compose up -d
npm ci
npm run typecheck
npm run build
npm run test:api:integration
```

### 6.2 Start API
```bash
npm run dev -w @okr-copilot/api
```

### 6.3 Baseline health + auth checks
```bash
curl -sS http://localhost:4000/health
curl -sS http://localhost:4000/modules
curl -sS http://localhost:4000/auth/status

# Mutating endpoint without auth should fail
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:4000/api/reminders/run-due

# Mutating endpoint with auth should pass
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:4000/api/reminders/run-due \
  -H 'x-auth-stub-token: dev-stub-token'
```

### 6.4 Existing OKR/check-in happy-path quick probe
```bash
# 1) Draft
curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Client delivery","timeframe":"Q2 2026"}'

# 2) Save
curl -sS -X POST http://localhost:4000/api/okrs \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"objective":"Improve client delivery outcomes","timeframe":"Q2 2026","keyResults":[{"title":"Ship weekly updates","targetValue":12,"currentValue":2,"unit":"updates"}]}'

# 3) List
curl -sS http://localhost:4000/api/okrs \
  -H 'x-auth-stub-token: dev-stub-token'

# 4) Check-in (replace KR_ID)
curl -sS -X POST http://localhost:4000/api/key-results/<KR_ID>/checkins \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"value":4,"commentary":"Excel wave regression probe"}'

# 5) Check-in history (replace KR_ID)
curl -sS "http://localhost:4000/api/key-results/<KR_ID>/checkins?limit=5" \
  -H 'x-auth-stub-token: dev-stub-token'
```

### 6.5 Excel import smoke commands (post-merge placeholders)
> Replace endpoint paths with final contract once merged.
```bash
# Upload workbook
curl -sS -X POST http://localhost:4000/api/okrs/imports/upload \
  -H 'x-auth-stub-token: dev-stub-token' \
  -F 'file=@./fixtures/qa/kr-import-valid.xlsx'

# Preview session
curl -sS -X POST http://localhost:4000/api/okrs/imports/<IMPORT_ID>/preview \
  -H 'x-auth-stub-token: dev-stub-token'

# Apply session
curl -sS -X POST http://localhost:4000/api/okrs/imports/<IMPORT_ID>/apply \
  -H 'x-auth-stub-token: dev-stub-token'
```

---

## 7) Regression checks (must remain green during Excel wave)

### 7.1 Automated regression
```bash
npm run test:api:integration
```
Must remain green, especially:
- OKR draft → save → update → check-in flow
- auth guard behavior on protected endpoints
- reminders retry/idempotency tests

### 7.2 Manual regression checklist
1. `POST /api/okrs/draft` still returns usable draft + metadata source.
2. `POST /api/okrs` persists objective + KR rows correctly.
3. `PUT /api/okrs/:id` still updates and preserves data integrity.
4. `POST /api/key-results/:id/checkins` still accepts value + commentary.
5. `GET /api/key-results/:id/checkins` still returns latest entries in expected order.
6. Read endpoints requiring auth still enforce auth.

---

## 8) Post-merge execution checklist (engineering output currently pending)
Run this exact block once Excel import PR merges:

```bash
git fetch --all
git checkout main
git pull --ff-only
npm ci
cp -n .env.example .env
docker compose up -d
npm run migrate
npm run typecheck
npm run build
npm run test:api:integration
```

Then execute Excel import wave tests in this order:
1. `EX-UP-001..004`
2. `EX-PR-001..006`
3. `EX-AP-001..006`
4. Full section 7 regression checks

Evidence to archive in `docs/qa/`:
- command transcript
- request/response payload samples
- failing row screenshots (preview errors)
- defect list mapped to matrix IDs

---

## 9) QA recommendation (current snapshot)
- **Excel import signoff status:** Pending engineering merge.
- **Baseline platform + existing OKR/check-in status:** Runnable; regression suite exists and should be treated as mandatory gate for Excel wave merge.