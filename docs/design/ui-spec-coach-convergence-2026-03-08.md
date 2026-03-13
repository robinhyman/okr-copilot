# UI Spec — Coach Convergence & Clarity Increment

Date: 2026-03-08  
Owner: UI/UX  
Input sources: expert review + baseline/contrast transcripts

## Goal
Reduce loop frustration and improve time-to-usable draft by making coach state transparent, enabling assumption-based handoff, and preventing low-quality/generic saves.

## Flow summary
1. **Discovery (Pass 1):** Coach gathers problem, audience/behavior change, timeframe, and candidate metrics.
2. **Transparency at every block:** If coach cannot finalize, response must show a compact **Known / Inferred / Missing** panel.
3. **Repetition cap + pivot:** After 2 asks for the same missing slot, coach must pivot to synthesis and provide options.
4. **Draft-with-assumptions handoff:** If user asks to finalize (or turn budget exceeded), coach produces best-possible draft with explicit assumptions/TBDs.
5. **Quality gate before save:** Prevent generic save if session contains concrete context (numbers, scope, constraints).
6. **Refinement entry ergonomics:** Chips and inline controls reduce typing burden and clarify next best action.

---

## Increment 1 — Blocking-turn transparency (Known / Inferred / Missing)

### UX behavior
On blocking turns, render a compact panel below coach response:
- **Known:** user-confirmed facts (e.g., “Q2 2026, Product team, activation 28%→40% target”).
- **Inferred:** coach assumptions from context (e.g., likely funnel bottleneck wording).
- **Missing:** minimum input required to remove block (single sentence or choice).

### Interaction details
- Missing items should be phrased as completion-ready prompts.
- If only one item is missing, highlight it as **Unlock item**.
- Include “Why this matters” one-liner for each missing item.

### Microcopy example
- **Missing (Unlock item):** First-value definition
- **Why this matters:** Needed to keep activation and TTFV metrics consistent.

---

## Increment 2 — Draft-with-assumptions handoff UX

### Trigger conditions
Show **Draft now with assumptions** CTA when any of:
- User explicitly asks to finalize/draft now.
- Same slot asked 2 times without resolution.
- Turn budget threshold reached (default: by user turn 6).

### Draft format requirements
Generated draft must include:
1. Objective
2. Rationale (2–3 lines)
3. Exactly 3 KRs (lagging, leading, guardrail)
4. **Assumptions block** (bullet list)
5. **TBD + validation plan** (what to confirm in first 2 weeks)
6. Confidence tags per KR (High/Medium/Low)

### UX controls
- Primary CTA: **Finalize draft with assumptions**
- Secondary CTA: **Answer one key question first**
- Tertiary CTA: **Edit assumptions**

---

## Increment 3 — Repetition cap & pivot messaging

### UX rule
After two semantically equivalent asks for one slot, coach cannot ask a third open-ended variant.

### Required pivot response structure
1. **Synthesis:** “Here’s what I heard…”
2. **Constrained choice:** 2–3 options + custom input
3. **Proceed choice:** “Use option A/B/C and draft now”

### User-visible loop recovery banner
- Banner text: **“I’m at risk of repeating myself. Let’s switch approach.”**
- Actions:
  - “Pick a definition”
  - “Draft with assumptions now”
  - “Guide me step-by-step”

---

## Increment 4 — No-generic-save safeguards + cues

### Save-time safeguard
If transcript contains concrete evidence (numbers/targets/scope/constraints), block generic placeholder save.

### UI cues
- Pre-save **Draft Quality Badge**:
  - Green: measurable objective + 3 KR structure complete
  - Amber: draft usable with assumptions
  - Red: generic/insufficient
- Red state must show missing quality checks and one-click fix action.

### Required checks (before save)
- Objective is outcome-led (not “define outcome”).
- 3 KR slots present and tagged lagging/leading/guardrail.
- Each KR has unit + target (baseline optional only if marked provisional).
- If provisional baseline used, include recalibration window note.

---

## Increment 5 — Chips & entry ergonomics refinements

### Recommended chips
- **Scope chips:** Team-only, New business only, Expansion only
- **Metric chips:** Win rate, Activation rate, Time-to-value, Stale opp share, Incident rate
- **Confidence chips:** Baseline confirmed, Rough baseline, Needs validation
- **Action chips:** Draft now, Ask one key question, Show assumptions

### Input ergonomics
- Pre-fill structured KR row when user provides “X → Y” values in free text.
- Inline editable assumption chips (tap to convert to text field).
- Keep keyboard focus in composer after chip insertion.

---

## UI states checklist
- Loading (coach thinking)
- Normal response
- Blocking response + Known/Inferred/Missing panel
- Loop-risk detected + recovery banner
- Draft-with-assumptions preview
- Save quality check (green/amber/red)
- Save blocked (generic fallback prevented)
- Error/retry states for generation and save

---

## Accessibility notes
- All chips and banners keyboard reachable (Tab/Shift+Tab), operable with Enter/Space.
- ARIA live region for state changes:
  - loop-risk detected
  - save blocked
  - draft-ready
- Do not use color alone for quality badge; include icon + text label.
- Minimum touch target 44x44 px for chips/CTAs.
- Maintain visible focus ring with 3:1 contrast minimum against adjacent colors.
- Keep panel reading order logical for screen readers: response → state panel → actions.
- Plain-language microcopy at ~B2 readability; avoid jargon in blockers.

---

## Measurable UX acceptance criteria

### Convergence & clarity
1. **Transparency compliance:** 100% of blocking turns show Known/Inferred/Missing panel.
2. **Repetition cap compliance:** 0 sessions with >2 semantically equivalent asks for same slot before pivot.
3. **Draft-on-request compliance:** ≥95% of explicit “finalize now” requests produce draft in the next coach turn.
4. **Time to first usable draft (TTFUD):** median ≤5 user turns.

### Output quality
5. **No-generic-save compliance:** 100% of sessions with numeric evidence avoid generic placeholder objective/KR.
6. **KR structure completeness:** ≥98% of saved drafts include exactly 3 KRs tagged lagging/leading/guardrail.
7. **Assumption disclosure:** 100% of assumption-mode drafts include assumptions + TBD validation plan.

### UX friction
8. **Loop-recovery action use:** ≥60% of loop-risk sessions recover to usable draft within 2 subsequent turns.
9. **Manual rewrite burden:** average post-save user edits reduced by ≥30% vs current baseline.
10. **Frustration proxy reduction:** phrases like “you’re repeating” / “just finalize” reduced by ≥50% over 4 weeks.

### Accessibility
11. **Keyboard success rate:** 100% critical actions (chips, draft CTA, save) executable without pointer.
12. **Screen reader announcements:** 100% of state transitions emit correct live-region announcement in QA script.

---

## Implementation notes (priority)
- **P0:** transparency panel, repetition cap+pivot, draft-on-request path, no-generic-save guard.
- **P1:** chip ergonomics + structured parse for “X→Y” metrics.
- **P2:** richer coaching warmth copy variants and domain chip presets.

## Out of scope (this increment)
- Full domain playbook library
- Deep persona/brand voice redesign
- Historical analytics backfill
