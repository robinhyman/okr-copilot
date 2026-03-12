# Coach transcript comparison (2026-03-08)

Compared artifacts:
- Baseline: `/Users/assistant/.openclaw/workspace/okr-copilot/docs/test-manager-coach-transcript-2026-03-08.md`
- Contrast: `/Users/assistant/.openclaw/workspace/okr-copilot/docs/test-manager-coach-transcript-contrast-2026-03-08.md`

## Side-by-side quality comparison

### 1) Clarity of prompts
- **Baseline transcript**
  - Prompts are mostly clear and specific at first.
  - However, the same core question (“what counts as first value?”) repeats multiple times, creating perceived non-responsiveness.
- **Contrast transcript**
  - Prompts are short and understandable.
  - But they repeatedly ask for “main business problem” despite user giving adjacent context, metrics, and targets.
  - Prompt progression feels linear but rigid; not enough acknowledgement of partial answers.

**Delta:** Baseline had better domain anchoring once definition was given; contrast had cleaner wording but weaker contextual adaptation.

### 2) Loop tendency signals
- **Baseline transcript signals**
  - Strong loop signal: near-verbatim repeated “first value” prompt across turns 8, 10, 14, 16.
  - User supplied adjacent context repeatedly, but assistant did not pivot until direct definition was given.
- **Contrast transcript signals**
  - Medium loop signal: semantic repetition (“main business problem”) across turns 2/3/4/5/7/8.
  - Not verbatim every time, but functionally repetitive and blocking draft progress.

**Delta:** Baseline shows harsher local repetition (same phrase); contrast shows broader stage-lock repetition (same unresolved slot).

### 3) Convergence speed (turn count to usable draft)
- **Baseline transcript**
  - Usable draft achieved after continuation once missing definition was provided.
  - Approximate user-turns to usable draft: **9** (including continuation turn that supplied definition).
- **Contrast transcript**
  - After **8 user turns**, still no usable draft.
  - Saved output remained fallback objective + 1 generic KR.

**Delta:** Contrast failed to converge within similar turn budget; baseline converged late but successfully.

### 4) Draft quality (specificity/measurability)
- **Baseline final draft quality**
  - Good specificity and measurable KRs:
    - Activation % 28 → 40
    - Time-to-first-value 9.5 → 6.0 days
    - Incidents 4 → 2
  - Includes lagging + leading + guardrail structure.
- **Contrast final saved draft quality**
  - Poor quality fallback:
    - Objective generic and non-strategic
    - Single KR (“process improvement”) not outcome-led for Sales funnel
    - Missing explicit lagging/leading/guardrail trio

**Delta:** Baseline final draft is operationally usable; contrast output is not.

## Recommended targeted fixes
1. **Introduce partial-credit progression logic**
   - If user provides two of three Pass-1 elements (problem, who, why-now), move forward with assumptions banner instead of re-asking same slot indefinitely.

2. **Add repetition cap + forced pivot**
   - After 2 semantically similar asks for same missing field, switch to:
     - concise synthesis of what is known,
     - one constrained multiple-choice clarifier,
     - optional “draft with assumptions now” path.

3. **Use “best-possible draft now” escape hatch**
   - When user explicitly asks for final draft, generate with explicit TBD markers rather than refusing draft production.

4. **Field-level missing-context display in assistant response**
   - Return a compact checklist (`known`, `inferred`, `missing`) so users see why assistant is blocked and what single input unlocks draft.

5. **Semantic de-dup guard at question planner layer**
   - Detect intent-equivalent prompts (not just verbatim duplicates) and force alternate question strategy.

## Verdict
- **Baseline**: imperfect (loop-prone) but ultimately convergent and high-quality.
- **Contrast**: more robust against verbatim repeat, but still overly gate-locked; poor convergence and poor final artifact quality.
- **Overall:** coaching flow still needs stronger anti-loop + assumption-based convergence behavior under ambiguous user input.