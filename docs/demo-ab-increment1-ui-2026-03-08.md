# Demo Notes — A/B Experiment Increment 1 UI (2026-03-08)

References (required):
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`
- `docs/spec-ab-experiment-2026-03-08.md`
- `docs/design/ab-experiment-ui-spec-2026-03-08.md`

## Scope delivered (Increment 1 UI)

Implemented in `apps/web/src/App.tsx`:

1. **Variant-driven entry behavior with endpoint fallback**
   - Added assignment resolver call to `GET /api/experiments/default-mode`.
   - Uses returned `defaultMode` to open either wizard-first or conversational-first experience.
   - On endpoint failure, silently falls back to control (`wizard` / `wizard_first`) and continues.

2. **Switch / escape hatch affordances**
   - Added modal header tertiary action: **Switch experience**.
   - Added confirmation panel with:
     - **Switch now**
     - **Cancel**
     - **Use stable experience** (escape hatch)
   - Escape hatch forces wizard mode in-session and surfaces a visible “Stable experience on” chip.
   - Switch confirmation banner added: “You’re now using Experience A/B. Your draft has been preserved.”

3. **Mode-specific entry surfaces**
   - Primary CTA now opens assigned default experience:
     - Wizard-first → wizard input + generate flow
     - Conversational-first → starts coach session flow
   - Resume draft path restores context and preserves existing draft data.

4. **Telemetry hooks (UI boundary, non-blocking)**
   - Added UI telemetry fire points (best-effort) for:
     - `ab_assignment_resolved`
     - `ab_exposure`
     - `coach_entry_clicked`
     - `ab_switch_initiated`
     - `ab_switch_confirmed`
     - `ab_switch_cancelled`
     - `ab_escape_hatch_used`
     - draft generation/save/publish response events
   - Telemetry includes experiment + variant + actor/session metadata where available.
   - Telemetry failures are non-blocking.

## Commands run + results

1. `npm run typecheck -w @okr-copilot/web`
   - ✅ Passed (`tsc --noEmit`)

2. `npm run test -w @okr-copilot/web`
   - ✅ Passed (`20 passed, 0 failed`)

3. `npm run build -w @okr-copilot/web`
   - ✅ Passed (Vite production build successful)

## Known limitations / open issues / blockers

1. **Backend telemetry ingest endpoint dependency**
   - UI emits to `POST /api/events/product`, but this endpoint is not present in current API routes.
   - Current behavior is safe (silent no-op on failure), but events are not persisted until backend endpoint exists.

2. **Experiment assignment endpoint dependency**
   - UI expects `GET /api/experiments/default-mode`.
   - If unavailable, fallback path works (wizard-first), but true assignment/variant behavior is limited to fallback mode.

3. **Draft variant persistence in API model**
   - UI reads optional `draft.variant` when resuming; this is not yet guaranteed by backend schema.
   - Current behavior safely falls back to current assignment/default mode.

4. **Accessibility hardening remains partial**
   - Basic aria-live and button semantics are in place.
   - Full focus-trap/restore implementation and additional keyboard-path validations are still pending for a later increment.

## Next increment proposal

- Implement API support for:
  - `GET /api/experiments/default-mode`
  - `POST /api/events/product` (batched)
  - persisted draft/session variant metadata
- Add focused UI tests for:
  - assignment fallback behavior
  - switch/escape hatch journeys
  - no-flicker default entry behavior
- Complete accessibility refinements (focus trap + restore + explicit Esc behavior gates).
