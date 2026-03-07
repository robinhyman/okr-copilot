# OKR Draft Creation Redesign (Product + UI Proposal)

## Problem
Current chat-led draft creation can re-ask the same context questions, creating a loop and poor UX.

## Proposed solution
Replace open-ended chat-first generation with a deterministic wizard.

### UX goals
- Finishable in one pass
- No repeated-question loop
- Clear progress and control
- Editable before save
- AI assist optional, bounded to one generation call
- Deterministic fallback always works

## Wizard flow (6 steps)
1. **Focus area** — what domain this OKR is for
2. **Timeframe** — quarter/date range
3. **Current baseline** — current metric state
4. **Constraints** — capacity/budget/risk boundaries
5. **Objective statement** — desired outcome sentence
6. **KR generation + review** — choose KR count, optional AI assist, generate full draft

## Interaction design
- Progress indicator: “Step N of 6”
- Previous/Next controls on every step
- Reset wizard action
- Final step has “Generate full draft”
- Generated draft opens in existing editor for manual refinement + save

## Data and contract changes
New API endpoint:
- `POST /api/okrs/wizard-draft`
- Input: `focusArea, timeframe, baseline, constraints, objectiveStatement, keyResultCount(2-5), aiAssist`
- Output: full draft object + metadata

Behavior:
- If `aiAssist=true`, try one LLM generation call
- On failure/unavailable, deterministic generation is used
- No multi-turn loop behavior in wizard path

## Non-goals
- Removing existing chat endpoint entirely (kept for compatibility)
- Changing save/check-in or RBAC model

## Acceptance criteria
- User can complete wizard and produce full draft with KRs
- No repetitive questioning in wizard path
- Draft save and downstream check-ins unchanged
- Tests cover wizard completion and loop regression
