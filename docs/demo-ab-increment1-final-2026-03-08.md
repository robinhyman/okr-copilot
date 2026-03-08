# Demo Handover — A/B Default Create Entry Increment 1

Date: 2026-03-08

References:
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`
- `docs/spec-ab-experiment-2026-03-08.md`
- `docs/architecture-ab-experiment-2026-03-08.md`
- `docs/design/ab-experiment-ui-spec-2026-03-08.md`

## 1) What changed

### Product behavior
- Added experiment-driven default create path:
  - `wizard_first` or `conversational_first` from backend assignment endpoint.
- Added in-flow switch + escape hatch to stable experience.
- Added telemetry emission hooks for assignment/exposure/switch/core journey actions.

### Backend/API
- `GET /api/experiments/default-mode` assignment + sticky behavior.
- Added telemetry ingest endpoint: `POST /api/events/product`.
- Added persistence tables for experiment assignments + product events.

### UI
- `apps/web/src/App.tsx` now resolves default mode from assignment endpoint.
- Safe fallback to wizard-first if assignment endpoint unavailable.

## 2) Test evidence

- `npm run test:api:integration` ✅ pass
- `npm run test -w @okr-copilot/web` ✅ pass
- `npm run release:gate` ✅ pass
- `docs/demo-ab-increment1-qa-gate-2026-03-08.md` = **GO**

## 3) Demo URL

- Web: `http://127.0.0.1:5173/overview`
- API health: `http://127.0.0.1:4000/health`

## 4) Access instructions

1. `cd okr-copilot`
2. `docker compose up -d postgres redis`
3. `npm ci`
4. `npm run migrate`
5. `npm run seed:demo`
6. `npm run dev`
7. Open `http://127.0.0.1:5173/overview`

## 5) Known limitations / risks

- Distribution check validates allocation sanity statistically, not production traffic outcomes.
- Accessibility hardening for focus-trap/restore still has follow-up items for a later increment.

## 6) Proposed next increment

- Production analytics/reporting layer for experiment decisioning:
  - variant-level publish conversion dashboard,
  - intention-to-treat vs as-treated reporting,
  - decision checkpoint at 2 weeks.
