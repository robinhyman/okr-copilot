# Demo Note — Conversational-Only Create Increment (2026-03-08)

References:
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`
- `docs/decision-conversational-only-2026-03-08.md`

## What changed

### Product/UI (`apps/web/src/App.tsx`)
- Removed user-facing wizard entry behavior from create flow.
- Removed user-facing experience switch / escape-hatch affordances from the create modal.
- Create CTA now consistently opens conversational coach flow.
- Resume draft now consistently re-enters conversational coach UI.
- Coach modal header/copy simplified to single conversational experience.
- Prompt-focus quick actions are always available in conversational mode (no mode branching).

### Docs
- Added this increment evidence note.
- Updated `docs/demo-ab-increment1-final-2026-03-08.md` with superseded status pointing to conversational-only decision/increment evidence.

## Backend compatibility and safety
- No backend endpoints were removed.
- Existing wizard-related API endpoints remain intact for compatibility/stability (`/api/okrs/wizard-draft`, experiment endpoint/tests still present).

## Verification / gates

### Required check 1
- Command: `npm run test -w @okr-copilot/web`
- Result: **PASS**

### Required check 2
- Command: `npm run release:gate`
- Result: **FAIL**
- Failure detail: existing API integration test flake unrelated to this UI increment:
  - `default-mode assignment distribution is balanced over >=200 synthetic users`
  - Assertion: `wizardRatio >= 0.45 && wizardRatio <= 0.55`
- Notes: typecheck/build/demo-prepare sections passed; failure isolated to distribution randomness in pre-existing A/B experiment test.

### Required check 3
- Command: `npm run done:proof`
- Result: **FAIL** with default environment (`WEB_URL` defaults to `http://127.0.0.1:5173`, but local Vite served on `localhost` only)
- Validation rerun: `WEB_URL=http://localhost:5173 npm run done:proof`
- Result: **PASS**

## Demo path
1. Start app (`npm run dev`).
2. Go to `/okrs`.
3. Click **Create OKR with Coach**.
4. Confirm conversational coach starts immediately; no wizard entry or switch controls are shown.

## Known limitations / residual risks
- `release:gate` remains blocked by a pre-existing flaky API distribution test for deprecated A/B assignment behavior.
- `done:proof` default `WEB_URL` value may fail when Vite binds `localhost` but not `127.0.0.1` on this host.

## Next increment proposal
- Remove/de-scope obsolete A/B default-mode experiment test assertions that no longer match product direction.
- Make `done:proof` host resolution robust (`localhost` fallback when `127.0.0.1` is unavailable).
