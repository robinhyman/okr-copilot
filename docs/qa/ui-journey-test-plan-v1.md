# UI Journey Test Plan v1 — Multi-Page Refactor

**Project:** OKR Copilot  
**Repo:** `/home/openclaw/.openclaw/workspace/projects/okr-copilot`  
**Date:** 2026-02-26  
**Owner:** QA

## 1) Purpose
This plan defines journey-based QA coverage for the upcoming move from the current single-page UI (`apps/web/src/App.tsx`) to a multi-page UI.

It is designed to:
- protect end-user outcomes through the refactor,
- verify cross-page state transitions and navigation behavior,
- prevent regressions in existing API-backed behavior,
- provide a clear pass/fail rubric for declaring the UI **pilot-ready**.

---

## 2) Current baseline and assumptions
### Current baseline (as of this plan)
- Current web experience is a single-page flow with 3 functional sections:
  1. Generate draft (`POST /api/okrs/draft`)
  2. Edit + save OKR (`POST /api/okrs`, `PUT /api/okrs/:id`, `GET /api/okrs`)
  3. KR check-ins + history (`POST /api/key-results/:id/checkins`, `GET /api/key-results/:id/checkins?limit=5`)
- API auth stub header is expected (`x-auth-stub-token`).

### Multi-page refactor assumptions
Expected pages (or equivalent route segments) after refactor:
- **Draft page** (prompt + generation)
- **Editor page** (objective/KR editing + save)
- **Check-ins page** (check-in submission + recent history)
- optional **Overview/Home page** (entry + status)

If route names differ, map tests to equivalent user-visible journeys and states.

---

## 3) Test strategy (journey-first)
We validate by user journey instead of component-only checks:
- **Critical path checks:** must-pass journeys for pilot viability.
- **State transition checks:** moving between pages without data loss/confusion.
- **Regression API checks:** ensure existing backend contracts still work with new UI wiring.
- **Negative paths:** recoverable failures with clear user feedback.

Execution layers:
- Manual exploratory + scripted manual checks (primary for v1)
- API integration suite (`npm run test:api:integration`) as regression safety net
- Optional Playwright/Cypress automation candidates listed in Section 11

---

## 4) Environment and data prerequisites
### Environment
- API: `http://localhost:4000`
- Web: `http://localhost:5173`
- Stub auth token configured in web env (`VITE_AUTH_STUB_TOKEN`, default `dev-stub-token`)

### Setup
1. `docker compose up -d`
2. `npm run setup:local`
3. `npm run dev`
4. Verify `/health` and `/api/okrs` reachable.

### Test data
- At least 1 OKR with 2+ KRs available for update/check-in tests
- At least 1 KR id known for API spot checks

---

## 5) Journey scenarios

## Journey A — Generate draft
### Objective
User can generate an OKR draft and understand source/feedback state.

### Scenarios
A1. **Happy path draft generation**
- Enter valid focus area + timeframe
- Trigger generation
- Observe loading state
- Receive populated draft
- Verify feedback message indicates success

A2. **Fallback metadata visibility**
- Simulate missing/invalid LLM path (or run in fallback mode)
- Generate draft
- Verify source badge/metadata shows fallback and reason when available

A3. **Error + retry recoverability**
- Force draft endpoint failure (e.g., API down or invalid response)
- Verify user-visible error text is clear and action-oriented
- Retry after recovery and confirm success

### Critical path checks
- No silent failure
- Draft is editable and not auto-persisted
- Generate action cannot create duplicate side effects unintentionally

### State transition checks (across pages)
- Navigating away from Draft to Editor preserves generated draft (or explicitly prompts/discards with clear confirmation)
- Refresh behavior is defined and consistent (restores from persisted state or clearly resets transient state)

---

## Journey B — Edit and save OKR
### Objective
User can modify objective/KR fields and persist correctly.

### Scenarios
B1. **Create new OKR from draft**
- Start from generated draft
- Edit objective/timeframe/KR fields
- Save
- Confirm success state
- Reload page/app and verify persisted values return from API

B2. **Update existing OKR**
- Load existing OKR
- Change KR current/target/unit/title
- Save update
- Confirm no duplicate OKR created, existing ID updated

B3. **Validation handling**
- Submit with invalid required fields
- Verify validation prevents save and points to correct fields
- Correct fields and save successfully

### Critical path checks
- Save operation maps to correct endpoint (`POST` create vs `PUT` update)
- Success message and post-save refresh are reliable
- Data shown after save matches backend response

### State transition checks (across pages)
- Draft -> Editor: all expected fields hydrated
- Editor -> Check-ins: updated KR values visible immediately or after intentional refresh
- Back/forward browser navigation retains coherent form state (no stale mixed draft/saved values)

---

## Journey C — Submit KR check-in and verify history
### Objective
User can submit check-ins with commentary and confirm historical visibility.

### Scenarios
C1. **Happy path check-in submission**
- Select KR
- Enter value + commentary
- Submit
- Verify success feedback
- Confirm KR current value updates and new history row appears

C2. **Check-in with commentary edge cases**
- Submit value only (empty commentary) if allowed
- Submit with long commentary near UI limit
- Confirm consistent display and no rendering break

C3. **Failure handling with retry**
- Trigger API failure on submit
- Verify form values are preserved for retry
- Recover and resubmit successfully

### Critical path checks
- Check-in writes once per submit action
- History ordering is correct (latest visible in recent list)
- Timestamp formatting is valid and not broken by locale/timezone

### State transition checks (across pages)
- Check-ins -> Editor -> Check-ins should not lose recent submit state unexpectedly
- Refresh after submit should preserve persisted history from backend

---

## Journey D — End-to-end “pilot demo loop”
### Objective
Validate full operator loop without dead-ends.

### Scenario
D1. **Generate -> Edit -> Save -> Check-in -> Confirm history**
- Execute full flow in one session
- Refresh app
- Confirm saved OKR and check-in remain consistent

### Critical path checks
- No blocking UX errors across route transitions
- No inconsistent state between pages for same entity
- Completion time is practical for pilot user (subjective UX sanity)

---

## 6) Cross-page state transition matrix

| Transition | Expected state behavior | Fail signals |
|---|---|---|
| Draft -> Editor | Generated fields available for editing | Blank editor, partial hydration, wrong objective/KRs |
| Editor -> Draft | Previously generated draft handled explicitly (retain/discard prompt) | Silent overwrite/reset |
| Editor -> Check-ins | Newly saved KR values available | Old values shown without refresh cue |
| Check-ins -> Editor | KR current value consistent with last successful check-in | Divergent current values |
| Any page -> refresh | Behavior documented and consistent | Random mixed state, stale drafts masquerading as saved |
| Browser back/forward | Route + state coherence maintained | Incorrect form values or wrong entity binding |

---

## 7) API regression checks (existing behavior)
Run these as part of UI refactor signoff to ensure no accidental contract breakage:

1. **OKR draft generation fallback behavior**
   - `POST /api/okrs/draft`
   - metadata source/provider/reason semantics still respected

2. **OKR CRUD happy path**
   - create (`POST /api/okrs`), update (`PUT /api/okrs/:id`), list (`GET /api/okrs`)
   - IDs stable, updates not duplicated

3. **KR check-in + history**
   - `POST /api/key-results/:id/checkins`
   - `GET /api/key-results/:id/checkins?limit=5`
   - current value + history integrity

4. **Validation and error code compatibility**
   - invalid payloads still return expected 4xx behavior consumed by UI

5. **Reminder-domain non-UI regression smoke (existing integration surface)**
   - retry scheduling and idempotent status callback behavior still pass via `npm run test:api:integration`
   - protects against collateral backend regressions during refactor branch merges

---

## 8) Non-functional UX checks (pilot-targeted)
- Loading indicators appear within 300ms of action
- Buttons disabled during in-flight requests to prevent duplicate submissions
- Error messages are understandable and recoverable (retry path obvious)
- No console errors that indicate broken state management
- Basic responsive usability at common laptop width

---

## 9) Pass/Fail rubric — “Pilot-ready UI”

## PASS (pilot-ready)
All must be true:
1. **Critical path**: Journeys A1, B1/B2, C1, D1 pass end-to-end.
2. **State transitions**: No Sev-1/Sev-2 defects in cross-page matrix.
3. **API regressions**: Core API regression checks pass; integration suite green for existing behavior.
4. **Error recoverability**: At least one forced failure scenario in each journey demonstrates clear recovery.
5. **Data integrity**: No data loss/duplication seen across save/check-in flows.
6. **UX baseline**: No blocker UX confusion (dead-end navigation, hidden primary actions, misleading status).

## CONDITIONAL PASS (pilot with guardrails)
- One or more non-critical defects (Sev-3) remain, with documented workaround and owner/ETA.
- No data integrity or critical path defects.

## FAIL (not pilot-ready)
Any of the below:
- Critical path journey fails.
- Cross-page state mismatch causing incorrect edits/check-ins.
- API regressions in core OKR/check-in behavior.
- Duplicate writes, silent save failure, or persistent stale-data rendering.

---

## 10) Refactor status handling
Refactor appears **not yet implemented** (current UI still single-page), so use this split plan.

### Pre-implementation checklist (before merge)
- [ ] Route map defined and agreed (Draft/Editor/Check-ins/etc.)
- [ ] State ownership model defined (URL params, context/store, server refresh boundaries)
- [ ] Unsaved-changes behavior specified for route changes
- [ ] Error model standardized across pages (shape + message strategy)
- [ ] Test IDs/hooks added for key controls (future automation)
- [ ] API contracts locked for refactor window (or versioned)

### Post-implementation validation plan (after merge)
- [ ] Execute Journeys A-D fully on refactor branch
- [ ] Execute cross-page transition matrix
- [ ] Run API integration regression suite
- [ ] Run manual exploratory pass for edge navigation (back/forward/refresh)
- [ ] Record defects by severity and map to PASS/CONDITIONAL/FAIL outcome
- [ ] Publish pilot readiness summary with evidence (screenshots/logs/test notes)

---

## 11) Suggested automation candidates (next wave)
1. Generate draft happy path + fallback badge assertion
2. Save create/update path endpoint assertion
3. Check-in submission with history row assertion
4. Browser back/forward state coherence test
5. Refresh persistence test after save/check-in

---

## 12) Exit artifacts
At end of execution, produce:
- Test run log by journey/scenario ID
- Defect list with severity + reproduction
- Pilot readiness decision using rubric in Section 9
- Known-risk list for pilot monitoring
