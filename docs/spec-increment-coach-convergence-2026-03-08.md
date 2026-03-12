# Product Increment Spec — Coach Convergence & Draft Reliability

Date: 2026-03-08  
Owner: Product Owner (OKR Copilot)  
Increment: `coach-convergence-v1`

## 1) Problem statements

1. The coach over-gates on missing single fields (e.g., one unresolved definition), causing stalled sessions even when enough evidence exists to draft a usable OKR.
2. The coach repeats semantically equivalent questions beyond acceptable tolerance, reducing trust and perceived intelligence.
3. When users explicitly request “final draft now,” the coach can refuse/deflect instead of producing a best-possible draft with assumptions.
4. Save behavior degrades to generic placeholder artifacts despite concrete numeric context existing in the transcript.
5. Current instrumentation is insufficient to detect loop behavior, draft-on-request failures, and artifact-quality regression quickly.

## 2) User outcomes

By end of this increment, users should:

1. Get a usable objective + exactly 3 measurable KRs within a predictable turn budget, even with partial ambiguity.
2. See fewer repeated questions and clearer progress when data is incomplete.
3. Receive a “draft with assumptions” immediately when they ask to finalize before all fields are confirmed.
4. Never lose transcript-specific quality at save time when metrics/targets already exist in conversation.
5. Experience transparent coaching state (known/inferred/missing) when clarification is still required.

## 3) Scope

### In scope (this increment)

1. **Non-refusal draft-with-assumptions policy path**
   - If user asks to finalize/draft now, generate best-possible draft in next turn unless safety/policy forbids.
   - Include explicit assumptions, confidence markers, and TBDs.

2. **Repetition cap and forced pivot**
   - Cap at max 2 semantically equivalent asks per unresolved slot.
   - On cap breach: mandatory synthesis + constrained clarifier options or immediate draft-with-assumptions.

3. **Anti-generic save behavior**
   - Save pipeline must hydrate from transcript evidence (numeric baselines/targets/constraints) when available.
   - Block fallback placeholder objective/KR when evidence threshold met.

4. **Instrumentation v1**
   - Add conversation and artifact telemetry needed to verify convergence improvement weekly.

5. **Acceptance suite v1**
   - Implement automated transcript-quality tests for convergence, loop resilience, and no-generic-save behavior.

### Out of scope (this increment)

1. Major UI redesign (full progress tracker UI, recovery modal UX).
2. Domain-specific metric libraries/playbooks (Sales/Product/CS packs).
3. Deep persona/tone overhaul beyond minimal clarity and transparency changes.
4. Multi-language prompt optimization.

## 4) Product behavior requirements

1. **Draft-on-request hard rule**
   - Trigger phrases: “finalize now,” “draft now,” “produce final draft,” equivalent intents.
   - Response must include:
     - objective statement,
     - short rationale,
     - exactly 3 KRs (lagging, leading, guardrail),
     - assumptions block,
     - explicit TBD list (if any).

2. **Partial-credit stage progression**
   - Stage progression is confidence-based, not binary completion-only.
   - If sufficient evidence exists for objective + provisional KR structure, coach proceeds and marks uncertainty.

3. **Repetition governance**
   - Semantic intent class tracked across rolling turns.
   - If same slot asked twice already, planner must pivot to one of:
     - synthesis confirmation,
     - multiple-choice clarifier,
     - draft-with-assumptions.

4. **Save-time salvage/hydration**
   - Prior to save, parse transcript evidence for metrics/baselines/targets/timeframe/scope.
   - If evidence present, saved artifact must reflect that evidence, not default placeholders.

5. **Transparency footer on blocking turns**
   - Blocking responses include compact `Known / Inferred / Missing` state.

## 5) Numbered acceptance criteria

1. When user explicitly requests final draft and at least one unresolved slot remains, system returns a draft in the next assistant turn (no refusal), with assumptions and TBDs.
2. Returned draft under Criterion 1 contains objective, rationale, and exactly 3 KRs labeled lagging/leading/guardrail.
3. No unresolved slot is asked with semantically equivalent intent more than 2 times without a pivot action.
4. After repetition cap is reached, assistant response includes synthesis of known facts and one constrained clarifier or a draft-with-assumptions.
5. If transcript contains numeric evidence (baseline and/or target candidates), saved version must not contain generic placeholder objective or single generic process-improvement KR.
6. Save pipeline populates available fields from transcript evidence (scope, timeframe, KR numeric values where present) with confidence tags for inferred values.
7. Blocking turns include `Known/Inferred/Missing` summary with at least one concrete next-step unlock.
8. Instrumentation events are emitted for: semantic repetition violations, unresolved slot age, draft-on-request trigger/compliance, time-to-first-usable-draft, fallback-save prevented/occurred.
9. Acceptance suite includes and passes at minimum: ambiguous-start convergence, finalize-on-demand, repeated-missing-slot pivot, semantic dedup, KR structure validation, no-generic-save.
10. In weekly production audit, median time-to-first-usable-draft is measurable and reportable from emitted telemetry (no manual reconstruction required).

## 6) Rollout and risk controls

### Rollout plan

1. **Phase 0 (internal):** enable behind feature flag `coach_convergence_v1` in dev/staging with transcript replay.
2. **Phase 1 (canary):** 10% of draft sessions for manager personas.
3. **Phase 2:** 50% if guardrail thresholds hold for 1 week.
4. **Phase 3:** 100% rollout, retain kill switch for immediate rollback.

### Risk controls

1. **Quality guardrail:** if KR completeness score drops >10% vs baseline week, auto-disable feature flag.
2. **Safety guardrail:** non-refusal rule still respects policy/safety constraints.
3. **Regression guardrail:** if generic-save rate increases week-over-week, block rollout progression.
4. **Operational guardrail:** monitor event ingestion completeness; missing telemetry >5% invalidates decision gate.

### Key risks and mitigations

- **Risk:** Over-eager drafting with poor assumptions quality.  
  **Mitigation:** force assumptions block + confidence tagging + weekly transcript QA.

- **Risk:** Semantic dedup false positives suppress valid follow-ups.  
  **Mitigation:** tune threshold using replay set; add override for truly distinct sub-intents.

- **Risk:** Save hydrator introduces incorrect inferred values.  
  **Mitigation:** provenance tagging (`user_stated` vs `inferred`) and conservative fill policy.

## 7) Success metrics (weekly)

1. **Draft-on-request compliance:** ≥95% (draft produced within one assistant turn after explicit request).
2. **Median Time-to-First-Usable-Draft (TTFUD):** ≤5 user turns.
3. **Semantic repeat violation rate:** <5% of sessions.
4. **No-draft session rate:** reduced by ≥60% from pre-increment baseline.
5. **Generic-save-with-evidence rate:** ≤1% of sessions with numeric transcript evidence.
6. **KR completeness pass rate:** ≥90% of generated drafts meet structure/measurability rubric.
7. **User frustration proxy incidence:** week-over-week decline in phrases indicating repetition/refusal.

## 8) Recommended next increment (post v1)

1. Progress tracker UI (Pass 1/Pass 2 + confidence).
2. Guided recovery modal when loop-risk detected.
3. Domain playbooks (Sales/Product/CS) for faster high-quality first draft generation.
4. Coaching tone refinements and “why I’m asking” microcopy.
