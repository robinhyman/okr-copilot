# Architecture Plan — OKR Coach Convergence Increment (Loop Resilience + Draft Reliability)

Date: 2026-03-08  
Author: Architect  
Inputs: `okr-coach-expert-review-2026-03-08.md` + transcript artifacts (baseline/contrast/comparison)

## 1) Architecture decision summary

This increment should harden the coach from a **strict gatekeeper** into a **transparent converger**: preserve OKR quality constraints while guaranteeing a usable draft path under ambiguity.

Primary decisions:
1. **Semantic loop detector v2 + repetition cap policy**
   - Move from simple same-theme/high-similarity checks to slot-aware semantic repetition accounting.
   - Enforce a hard cap: max 2 asks per unresolved slot intent before mandatory pivot.
2. **Forced pivot + draft-with-assumptions path (non-refusal on request)**
   - If loop cap hit or user explicitly asks “finalize/draft now”, produce draft in next turn with assumptions + confidence + TBD markers.
3. **Anti-generic-save guardrails**
   - Prevent saving fallback placeholder drafts when transcript contains concrete metrics/targets.
4. **Instrumentation schema + metrics pipeline**
   - Add turn-level analytic facts to compute SRI, unresolved slot age, TTFUD, no-draft rate, and draft-on-request compliance.
5. **Transcript acceptance harness**
   - Add scenario-based quality tests that assert convergence behavior, not only schema validity.

This is an additive, feature-flagged release with rollback-by-disable and no destructive migrations.

---

## 2) Current-state findings (from code + transcripts)

Observed in `apps/api/src/services/ai/okr-draft-provider.ts`:
- Existing `applyLoopMitigation` already computes loop signals (`same_theme_repeat`, `semantic_repeat`, `question_streak`, `answered_field_still_missing`).
- Existing mitigation can pivot to assumptions, but trigger policy is coarse and not aligned to explicit **slot repetition cap**.
- Missing-context behavior remains effectively binary-gated in several paths.

Observed in reviewed transcripts:
- Baseline: repeated “first value” prompts (T8/T10/T14/T16) before usable draft.
- Contrast: semantic repeats on “main business problem” across multiple turns; no usable draft despite enough numeric evidence and explicit finalize request.
- Final saved artifact in contrast regressed to generic fallback objective + generic KR.

Architectural conclusion: convergence failure is caused by **insufficient slot-state memory + weak forced-pivot policy + unsafe save fallback**, not by lack of draft generation capability.

---

## 3) Target architecture (boundaries and components)

## 3.1 Backend components

1. **SlotState Engine (new module)**
   - Tracks required slots (`outcome`, `strategicWhy`, `baseline`, `target`, `constraints`, `timeframe`, plus domain slot `firstValueDefinition` where relevant).
   - Per-slot state: `{status: known|inferred|missing, confidence: 0..1, askCount, lastAskedTurn, lastAnsweredTurn}`.

2. **Semantic Loop Detector v2 (replace/extend current mitigation scoring)**
   - Inputs: recent assistant intents, slot ask history, semantic similarity, unresolved-slot age.
   - Output: `{loopRiskScore, repeatedSlot, repeatedIntentClass, capExceeded, action}`.

3. **Convergence Governor (new policy layer)**
   - Enforces:
     - `askCount(slot) <= 2` before mandatory strategy switch.
     - explicit user draft request => immediate draft path.
     - turn-budget trigger (default by user turn 6): offer draft skeleton if still in questions mode.

4. **Draft Salvage + Save Validator (new guardrail layer)**
   - On save: if transcript evidence includes numeric targets/baselines and draft is generic placeholder, auto-hydrate from extracted evidence or block save with machine-readable warning.

5. **Telemetry Emitter + Fact Writer**
   - Emits per-turn analytic event payload and persists normalized facts.

## 3.2 Web/API surface behavior

- API responses remain backward-compatible, but include additive metadata:
  - `metadata.loop` with cap status and chosen action.
  - `metadata.progress` with known/inferred/missing map.
  - `metadata.convergence` with `draftOffered`, `draftReason` (`user_requested|cap_exceeded|turn_budget|normal`).

- UI can progressively expose:
  - compact Known/Inferred/Missing footer,
  - “Draft with assumptions now” action,
  - warning on low-specificity save attempts.

---

## 4) Interface and data contract changes (additive)

## 4.1 Chat response contract (`POST /api/okr-drafts/:id/chat`)

Additive `metadata` fields:
- `loop`: `{ score:number, repeatedSlot?:string, repeatedIntentClass?:string, capExceeded:boolean, stage:string }`
- `progress`: `{ known:string[], inferred:string[], missing:string[] }`
- `convergence`: `{ draftOffered:boolean, draftReason:string, draftOnRequest:boolean }`
- `assumptions`: `string[]` (present when draft generated with assumptions)
- `confidenceByKr`: `Array<{krIndex:number, confidence:number, reasons:string[]}>`

## 4.2 Save contract (`POST /api/okr-drafts/:id/versions`)

Additive validation outcome:
- `qualityGuards`: `{ genericSavePrevented:boolean, salvageApplied:boolean, evidenceUsed:string[] }`
- If hard-block path enabled by flag: 422 with code `GENERIC_SAVE_BLOCKED_WITH_EVIDENCE`.

## 4.3 Storage schema (new additive tables)

Migration: `010_coach_convergence_metrics.sql`

1. `coach_turn_facts`
- `id`, `draft_session_id`, `turn_index`, `role`, `intent_class`, `slot`, `slot_status`, `slot_ask_count`, `slot_age_turns`, `semantic_repeat_score`, `loop_risk_score`, `cap_exceeded`, `draft_offered`, `draft_on_request`, `created_at`.

2. `coach_session_metrics`
- `draft_session_id`, `first_usable_draft_turn`, `ttfud_turns`, `no_draft_session`, `draft_on_request_compliant`, `max_unresolved_slot_age`, `avg_sri`, `created_at`, `updated_at`.

No existing column mutations; safe additive rollout.

---

## 5) Metric definitions and pipeline

Computed nightly + on session close:

1. **SRI (Semantic Repetition Index)**
   - Rolling 4-turn mean cosine similarity of assistant question intents (or embedding similarity fallback).
   - Session SRI = mean rolling score.

2. **Unresolved Slot Age**
   - For each required slot: `current_turn - first_missing_turn` until resolved.
   - Session metric: max and p95 slot age.

3. **TTFUD (Time to First Usable Draft)**
   - User turns until first draft containing objective + exactly 3 measurable KRs (lagging/leading/guardrail tags present).

4. **No-draft rate**
   - `% sessions closed/saved without usable draft`.

5. **Draft-on-request compliance**
   - `% explicit user draft/finalize requests answered with draft in same or next assistant turn`.

Pipeline:
- Online write: per-turn facts from chat path.
- Batch materialization: session aggregates into `coach_session_metrics`.
- Dashboard/alerts: threshold alerts (e.g., compliance <95%, no-draft rate > baseline + 10%).

---

## 6) Behavior policy specification

## 6.1 Repetition cap policy
- For each unresolved slot intent class, `max_asks = 2`.
- Third attempt must not be another open-loop re-ask.
- Required third-step actions (priority order):
  1. synthesis + constrained options,
  2. draft-with-assumptions,
  3. single-key clarifier only if safety-critical field.

## 6.2 Forced pivot rules
- Trigger when any true:
  - `capExceeded == true`,
  - explicit user draft request,
  - turn budget reached (`userTurn >= 6`) with sufficient evidence.
- Output must include:
  - assumptions block,
  - KR confidence tags,
  - explicit TBD list with closure plan.

## 6.3 Anti-generic-save rules
- If evidence extractor detects numeric baseline/target data in transcript, placeholder objective/process-improvement-only draft is invalid.
- Save path applies salvage using extracted evidence before accepting save.

---

## 7) Acceptance test harness (transcript quality)

Create `apps/api/src/tests/coach-convergence.acceptance.test.ts` and fixture pack under `docs/qa/coach-convergence-fixtures/`.

Test groups:
1. **Loop resilience**
   - repeated-missing-slot scenario: assert no >2 semantic repeats for same slot.
2. **Finalize-on-demand**
   - explicit “produce final draft now” with one missing slot: assert draft in next turn with assumptions.
3. **Partial-credit progression**
   - fuzzy context + rough numbers: usable draft by <=6 user turns.
4. **Anti-generic-save**
   - transcript contains numbers; generic fallback attempt should salvage or block with guard code.
5. **Metric integrity**
   - SRI/slot-age/TTFUD/compliance fields populated and within expected range for fixtures.

Pass criteria (release gate):
- 100% deterministic pass on acceptance fixtures.
- No-draft fixture count reduced vs baseline set.
- Draft-on-request compliance fixtures: 100%.

---

## 8) Sequencing plan

## Phase 0 — Prep (same day)
1. Add feature flags:
   - `FF_COACH_LOOP_V2`
   - `FF_COACH_FORCED_PIVOT`
   - `FF_COACH_ANTI_GENERIC_SAVE`
   - `FF_COACH_CONVERGENCE_TELEMETRY`
2. Land migration `010_coach_convergence_metrics.sql`.

## Phase 1 — Core policy engine
3. Implement SlotState engine and integrate into `continueConversation` pipeline.
4. Implement loop detector v2 + repetition cap evaluator.
5. Implement Convergence Governor (draft-on-request + turn-budget).

## Phase 2 — Draft safety
6. Implement save guard + salvage hydrator.
7. Add API contract fields and fallback compatibility.

## Phase 3 — Telemetry + metrics
8. Emit turn facts and materialize session metrics.
9. Add dashboard queries and alert thresholds.

## Phase 4 — Acceptance harness + rollout
10. Add transcript fixture tests and release gate.
11. Staging shadow run (telemetry only) for 24h.
12. Progressive enablement: 10% → 50% → 100%, monitoring no-draft and compliance.

---

## 9) Migration and rollback safety

Migration strategy:
- Additive tables only; no destructive schema changes.
- Dual-write tolerant: if fact write fails, chat response still succeeds (non-blocking telemetry).

Rollback strategy:
1. Disable flags in reverse order:
   - telemetry → anti-generic-save hard block (fallback to warn-only) → forced pivot → loop v2.
2. Keep additive tables in place (no rollback migration required).
3. Revert to existing `applyLoopMitigation` path by flag.

Safety checks:
- Canary monitors on API latency and error rate.
- Guard against over-pivoting by tracking sudden drop in question quality score.

---

## 10) Risks and mitigations

1. **False-positive loop detection causing premature drafting**
   - Mitigation: confidence thresholds + staged rollout + per-slot cap exceptions for safety-critical slots.

2. **Over-aggressive save blocking hurting UX**
   - Mitigation: two-step rollout (warn-only, then block), auto-salvage before reject.

3. **Telemetry cardinality/perf overhead**
   - Mitigation: compact schema, bounded signal enums, async write path.

4. **Inconsistent KR confidence tagging**
   - Mitigation: deterministic rubric for confidence assignment and fixture assertions.

---

## 11) Done criteria

- Boundaries explicit: SlotState/LoopDetector/Governor/SaveGuard are isolated modules.
- Repetition cap enforced in tests and production telemetry.
- Explicit draft request always yields draft within one turn.
- Generic fallback save prevented when evidence exists.
- SRI, slot age, TTFUD, no-draft rate, draft-on-request compliance measurable per session.
- Rollback is flag-only and low risk.
