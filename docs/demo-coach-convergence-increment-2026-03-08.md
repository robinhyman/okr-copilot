# Demo Evidence — Coach Convergence Increment (2026-03-08)

## Scope Delivered

Implemented coach convergence increment across API + web UI with:

1. **Non-refusal draft-with-assumptions path**
   - Explicit finalize intent detection (`finalize now`, `draft now`, `first full draft`, etc.).
   - Forced draft synthesis when user explicitly requests finalization, semantic slot-cap exceeds limit, or turn budget drifts.
   - Draft includes explicit assumptions/TBD rationale and `draftOnRequestCompliant` metadata.

2. **Semantic repetition cap per slot (max 2) + forced pivot**
   - Added semantic slot repeat cap (`slot_cap_exceeded`) using prompt-theme classification.
   - Added forced pivot behaviors:
     - multiple-choice recovery prompt
     - assumption synthesis path with refine-mode draft

3. **Anti-generic-save safeguards with concrete context**
   - Extract transcript numeric evidence from chat messages.
   - On save, detect generic draft templates and salvage first KR/objective with known evidence.
   - Save metadata includes `genericSavePrevented`, `salvageApplied`, `evidenceUsed`.

4. **Known / Inferred / Missing transparency in UI + loop recovery messaging**
   - Added metadata progress object (`known`, `inferred`, `missing`, `unlockItem`).
   - UI conversation transcript now renders counts and next unlock item.
   - UI shows loop recovery path labels.

5. **Instrumentation signals**
   - Added metadata + event payload support for:
     - `sri` (semantic repetition index)
     - `unresolvedSlotAge`
     - `ttfudTurns`
     - `draftOnRequestCompliant`
   - Included in `coach_response_received` product telemetry and chat version metadata persistence.

6. **Acceptance harness additions**
   - Added integration tests for:
     - finalize-now draft compliance + assumptions
     - anti-generic-save salvage with transcript evidence
   - Extended status-format test coverage with diagnostics fields.

## Gate Runs

### 1) `npm run test -w @okr-copilot/web`
- PASS
- 20/20 tests passing

### 2) `npm run release:gate`
- PASS
- typecheck: PASS
- build: PASS
- test (api + web): PASS
- demo:prepare: PASS
- release acceptance checks: PASS

### 3) `npm run done:proof`
- PASS
- api_health: PASS
- web_overview: PASS
- domain_data.okrs: PASS
- manager_digest: PASS

## Notes

- Existing conversational-first flow and deterministic first-turn behavior retained.
- Clarity/anti-loop behavior remains intact and is now augmented with slot-cap and explicit convergence telemetry.
