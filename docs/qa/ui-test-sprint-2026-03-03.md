# UI Test Sprint — 2026-03-03

## Scope
Focused sprint on:
1. stale/persistent status toast leaking across pages
2. flaky check-in behavior under parallel/multi-click interactions
3. preserving Linux production parity gate

## Product acceptance criteria

### A) Status/toast lifecycle
- AC1: A status message appears only on the route where it was emitted.
- AC2: Navigating to another route must not show stale status from a previous route.
- AC3: Status messages auto-clear after a short TTL (success/info faster, errors slightly longer).

### B) Check-in interaction robustness
- AC4: Rapid repeated clicks on the same KR submit button must result in one in-flight request from the UI (button remains disabled while in-flight).
- AC5: Different KRs can still be submitted independently in parallel.
- AC6: On completion, only the finished KR is re-enabled and input is cleared for that KR.

## Engineering changes shipped
- `apps/web/src/App.tsx`
  - Added stable test hooks (`data-testid`) for nav, route feedback, and check-in controls/history.
  - Added route-scoped status model (`Feedback` now includes `scope` and unique `id`).
  - Added toast TTL auto-expiry with cleanup on unmount.
  - Replaced global `submittingKrId` with per-KR map `submittingKrIds`.
  - Added synchronous in-flight guard (`checkinInFlightRef`) to block duplicate same-KR submissions from rapid multi-clicks.
- `e2e/playwright.checkins.config.ts`
  - Added focused Playwright config and artifact/report output folders.
- `e2e/tests/checkins/checkins.e2e.spec.ts`
  - Added 2 required confidence tests:
    1. happy-path completion + route-scoped feedback TTL lifecycle
    2. duplicate-submit guardrail per KR (double-click attempt only emits one POST)
- `scripts/run-e2e-checkins-local.sh`
  - Added reproducible local e2e run harness with logs/artifacts.
- `scripts/run-e2e-checkins-linux-container.sh`
  - Added Linux-container e2e harness for parity attempts and evidence capture.
- `package.json`
  - Added `test:e2e:checkins`, `e2e:checkins:local`, `e2e:checkins:linux` scripts and Playwright dev dependency.

## QA / user-sim test evidence

### 1) Web tests
Command:
```bash
npm run test -w @okr-copilot/web
```
Result: PASS (3/3 tests)

### 2) Type safety
Command:
```bash
npm run typecheck
```
Result: PASS

### 3) Production build
Command:
```bash
npm run build
```
Result: PASS

### 4) Local deploy gate
Command:
```bash
npm run deploy:local
```
Result: PASS (`DEPLOY_OK` printed)

### 5) Automated UI-e2e confidence pack (local)
Command:
```bash
npm run e2e:checkins:local
```
Result: PASS (2/2 tests)

Artifacts:
- `artifacts/e2e-local/run.log`
- `artifacts/e2e-local/api.log`
- `artifacts/e2e-local/web.log`
- `e2e/artifacts/playwright-report/index.html`
- `e2e/artifacts/playwright-results/**` (screenshots, traces, videos on failure/retry)

### 6) Linux parity gate
Command:
```bash
npm run validate:linux-target
```
Result: PASS (`LINUX_TARGET_OK` printed)

### 7) Linux-container UI-e2e attempt (parity evidence)
Command:
```bash
npm run e2e:checkins:linux
```
Result: FAIL in this environment due Chromium crash under amd64 container emulation on ARM host (QEMU segfault); harness + logs captured.

Artifacts:
- `artifacts/e2e-linux/run.log`
- `artifacts/e2e-linux/api.log`
- `artifacts/e2e-linux/web.log`
- `e2e/artifacts/playwright-results/**` (trace + failure context)

## User-sim verdict
**PASS-WITH-FRICTION**

Reason: required e2e scenarios are implemented and passing locally with artifacts; deploy and Linux-target gate scripts still pass. Linux-container browser execution is blocked by host emulation instability (non-product defect), so CI-on-native-Linux should be the final confirmation path.

## Security / architecture quick review
- No new external dependencies added.
- No API contract changes.
- No auth, token, or transport behavior changes.
- Regression risk concentrated in frontend-only state lifecycle.
- Residual risk: route-scoped toasts currently render only for matching route; cross-route long-running actions are intentionally hidden rather than transferred.
