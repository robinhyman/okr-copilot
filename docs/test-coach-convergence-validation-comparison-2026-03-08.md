# Coach convergence validation comparison (2026-03-08)

Compared against prior behavior documented in:
- docs/test-manager-coach-transcript-2026-03-08.md
- docs/test-manager-coach-transcript-contrast-2026-03-08.md
- docs/test-coach-transcript-comparison-2026-03-08.md

## Scenario outcomes

### 1) Baseline structured (mgr_product / team_product)
- Raw result: usable draft first appeared at turn **7** (improved from prior ~9).
- Stability: **regressed after turn 8-9**, where coach reverted to discovery and final saved draft fell back to generic 1-KR template.
- Final convergence assessment: **Not converged (unstable convergence / draft regression)**.
- Draft-on-request compliance: not exposed in metadata (no positive compliance signal observed).

### 2) Fuzzy ambiguous (mgr_sales / team_sales)
- Raw result: no usable 3-KR draft after **10 turns**.
- Coach behavior: slightly better constrained clarifier prompts (multiple-choice style), but still stage-locked on a single missing field and refused drafting even after explicit draft request.
- Final convergence assessment: **Not converged**.
- Draft-on-request compliance: no compliant draft on explicit request.

## Improvements vs prior
- Baseline time-to-first-usable-draft improved (from ~9 turns to 7 turns).
- Fuzzy path clarifying question quality improved marginally (more structured options vs open repetition).

## Regressions vs prior
- Major: baseline generated usable draft then later **collapsed to fallback generic draft**, indicating state persistence/convergence stability issue.
- Major: metadata instrumentation expected by convergence increment (progress, sri, loopDetected, draftOnRequestCompliant) was effectively absent (N/A) in these live responses, reducing observability and making loop control unverifiable.
- Major: fuzzy scenario still fails draft-on-request behavior and remains non-convergent.

## Quantitative summary
- Baseline structured: converged = **No (unstable)**; turns to usable draft = **7**; final saved usable = **No**.
- Fuzzy ambiguous: converged = **No**; turns to usable draft = **N/A (not reached in 10 turns)**; final saved usable = **No**.

## Recommendation for convergence objective
**NO-GO**

Rationale: despite earlier draft emergence in baseline, the flow is not reliably convergent because it can regress to fallback output and still fails ambiguous/fuzzy manager workflows. Shipping this as “convergence fixed” would be misleading until (a) draft stability is guaranteed once usable draft exists, and (b) draft-on-request escape path works under ambiguity.
