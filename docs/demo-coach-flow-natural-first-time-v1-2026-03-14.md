# Demo Evidence — Coach Flow Natural First-Time v1 (2026-03-14)

References:
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`

## Increment brief
Improve first-time coaching flow quality end-to-end by reducing question-loop fatigue, keeping deterministic control at boundaries, and making guided replies visible at the input moment.

## Scope
In scope:
1. API coaching loop mitigation and draft progression behavior.
2. UI conversational composer guidance (suggested reply chips above composer).
3. Telemetry continuity for loop detection/escape and chip-click usage.
4. Demo readiness reseed + inspectability proof.

Out of scope:
- New OKR ontology.
- Major UI redesign outside coach composer lane.

## Team synthesis (operating-model roles)
- Product Owner: prioritized first-time user friction (too many repeated probing turns before usable draft).
- Architect: keep deterministic logic at system boundaries (validation/save), avoid heavy mid-turn control; use adaptive loop mitigation metadata.
- UI/UX: place suggested replies directly above composer to lower cognitive/interaction friction.
- Backend/API: activate existing loop-mitigation layer across LLM and fallback paths; relax early hard-question gating.
- QA: add explicit loop-mitigation unit coverage and update integration expectations to new metadata contract.
- Release Gate: require typecheck/build/tests + done-proof + seeded data verification.

Complexity classification: **Medium** (cross-layer behavior change: API conversation policy + UI interaction + tests).

## What shipped
### API (`apps/api/src/services/ai/okr-draft-provider.ts`)
- Applied `applyLoopMitigation(...)` in resilient conversation path for both LLM success and deterministic fallback.
- Relaxed intrusive early gating in LLM conversation mode:
  - strict question forcing only in very early low-context turns,
  - allows refinement path when user explicitly asks to draft or conversation has progressed.
- Preserved metadata signals (`loopDetected`, `loopStage`, `loopSignals`, `loopEscapePath`, progress fields) for auditability.

### UI (`apps/web/src/App.tsx`, `apps/web/src/styles.css`)
- Added suggested reply chips above the composer using `coachPrompts`.
- Chip click now sends text directly through existing turn pipeline and emits `coach_prompt_chip_clicked` product event.
- Maintained Enter-to-send / Shift+Enter newline behavior already in place.

### Tests
- Added: `apps/api/src/tests/okr-draft-provider.loop-mitigation.test.ts`
  - verifies escalation to assumption synthesis and refine mode after repeated discovery with “draft now with assumptions” intent.
- Updated integration expectation:
  - `apps/api/src/tests/okrs.integration.test.ts` now verifies loop diagnostics metadata is emitted and assistant message remains usable.

## Evidence (checks run)
1. `npm run test -w @okr-copilot/api` ✅ (40/40 pass)
2. `npm run test -w @okr-copilot/web -- App.test.ts` ✅ (21/21 pass)
3. `npm run typecheck` ✅
4. `npm run build` ✅
5. `npm run done:proof` ❌ initially (`domain_data.okrs count=0`)
6. `npm run seed:demo` ✅ reseeded all demo teams
7. `npm run done:proof` ✅ final pass (`DONE_PROOF: PASS`)

## Demo path and access
- Web: `http://127.0.0.1:5173/okrs`
- API: `http://127.0.0.1:4000/health`
- Persona: manager in any seeded team (`mgr_product`, `mgr_sales`, `mgr_ops`).

Walkthrough:
1. Open **Create OKR with Coach**.
2. Provide partial inputs and repeat uncertainty once/twice.
3. Use suggested chips above composer.
4. Ask to “draft now with assumptions”.
5. Confirm response moves to refine mode with assumption-based draft and loop metadata.

## Risks / rollback
Risks:
- Earlier draft synthesis could over-assume in low-context cases.
- New loop metadata volume could affect downstream analytics queries expecting nulls.

Rollback:
- Revert commit for provider mitigation + LLM gating adjustments.
- Revert App composer chips block.
- Re-run `npm run test -w @okr-copilot/api && npm run test -w @okr-copilot/web && npm run done:proof`.

## Mandatory retrospective
Outcome: **PASS with one corrective action identified**.
- What went well: existing `applyLoopMitigation` design was strong; enabling it gave immediate behavior gain with low code churn.
- What was painful: legacy integration test assumed loop metadata suppression; this was outdated.
- Corrective action: keep integration assertions aligned with current observability contract whenever coaching metadata policy changes.

## Recommended next action
Add a lightweight “progress strip” in the coach modal (Known / Missing / Assumptions accepted) to make refinement state transparent for first-time users without forcing deterministic mid-conversation control.
