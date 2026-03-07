# OKR Copilot — Mobile Usability Feedback (User-Agent Simulation)

Date: 2026-03-06  
Scope: Simulated mobile journeys for **manager** and **team member**, both **first-time** and **returning** usage.  
Method: Heuristic walkthrough against current documented IA/flows (`Overview`, `OKRs`, `Check-ins`, manager digest, KR check-in modal), with realistic user intent simulation.

---

## 1) Personas and test lens

### Persona A — Manager (time-poor)
- Context-switching between meetings
- Needs fast risk scan + delegation
- Uses phone between calls
- Trust threshold: must understand “why this is risky” instantly

### Persona B — Team Member (execution-focused)
- Wants to update progress quickly with minimal friction
- Often checks in while commuting / between tasks
- Trust threshold: must feel updates are saved and visible to manager

Device assumptions:
- iPhone/Android, narrow viewport
- One-handed use, intermittent connectivity

---

## 2) Journey simulations and findings

## Journey M1 — Manager first-time mobile (setup → first overview)

### Expected intent
“Get started quickly and understand what I should do this week.”

### What works
- Route structure is clear conceptually (Overview/OKRs/Check-ins).
- Empty-state CTAs (Generate draft) provide a path out of blank screens.

### Friction / confusion
1. **No explicit role framing on first run (manager vs contributor mode).**
   - User quote: *“Is this view personalized for me as a manager, or generic?”*
   - Impact: weak confidence in recommendations.

2. **Navigation labels are internally clear, externally ambiguous.**
   - “History” and “Overview” overlap mentally for new users.
   - User quote: *“I expected History to show trend charts, but it’s just events?”*

3. **Draft generation language is system-centric, not outcome-centric.**
   - “Generate draft” without quality expectations or time estimate.
   - User quote: *“Will this give me something usable or random AI fluff?”*

4. **Trust gap in AI source badge (`LLM/Fallback`)**
   - Badge informs implementation path, not user confidence.
   - User quote: *“Fallback sounds like lower quality. Should I trust this draft?”*

### Failed intents
- **Intent:** “Set up my team structure now.”  
  **Failure:** Member/permissions is later-scope; missing clear “not yet available” affordance.  
  **User quote:** *“Where do I add my team? I can’t run OKRs alone.”*

---

## Journey M2 — Manager returning mobile (weekly risk triage + nudge)

### Expected intent
“Scan risk in <2 minutes, nudge owners, schedule follow-up.”

### What works
- Manager digest redesign direction is strong: priority cards + reason chips + quick actions.
- Inline actions (`Nudge owner`, `Schedule check-in`) support workflow.

### Friction / confusion
1. **Risk reasoning still too compressed on small screens.**
   - Chips like “Regression / Stale / Blockers” lack immediate causality.
   - User quote: *“What changed this week? Why is this now red?”*

2. **Action feedback ambiguity (did my nudge actually send?).**
   - If feedback is global, managers lose context per card.
   - User quote: *“I tapped Nudge… was that for KR #1 or #2?”*

3. **No explicit undo/snooze control on manager actions.**
   - Missing safety net for accidental taps on mobile.
   - User quote: *“I fat-fingered schedule check-in. Can I undo that?”*

4. **Quality metrics (stale/blockers) present but not explorable.**
   - Users cannot drill quickly into “which KRs are stale”.

### Failed intents
- **Intent:** “Only show KRs I directly manage right now.”  
  **Failure:** Missing quick filter in digest.  
  **User quote:** *“This list is useful, but I need ‘my directs only’ on mobile.”*

---

## Journey T1 — Team member first-time mobile (first check-in)

### Expected intent
“Understand what to update and submit in under 5 minutes.”

### What works
- KR-per-card mobile pattern is appropriate.
- Full-width action buttons and preserved input on errors are good for mobile resilience.

### Friction / confusion
1. **Metric input expectations are unclear before typing.**
   - Users don’t always know required format/range/unit.
   - User quote: *“Do you want % complete, absolute number, or milestone count?”*

2. **Commentary field purpose is under-specified.**
   - Is it optional status context or mandatory evidence?
   - User quote: *“What kind of note is helpful here?”*

3. **Submit model mismatch (per-KR vs submit-all mental model).**
   - Some docs indicate per-KR submit; journey docs emphasize batch submit-all.
   - User quote: *“Did I submit one KR or all of them?”*

4. **Weak social visibility cue.**
   - No clear reassurance that manager will see this update.
   - User quote: *“Is this just logged, or does anyone get notified?”*

### Failed intents
- **Intent:** “Save draft and finish later.”  
  **Failure:** Missing explicit draft-save for partial check-ins.  
  **User quote:** *“I need to stop here and come back without losing half-done notes.”*

---

## Journey T2 — Team member returning mobile (weekly repeat)

### Expected intent
“Quickly repeat last week’s update style; update only changed KRs.”

### What works
- Recent history in context supports continuity.
- Objective filter helps reduce list size.

### Friction / confusion
1. **High typing burden for repeated commentary.**
   - No templates/smart suggestions (e.g., “same as last week + delta”).

2. **No “skip/no change” explicit control.**
   - Team members forced into awkward low-value entries.
   - User quote: *“Nothing changed; I don’t want to fake an update.”*

3. **Confidence gap on data integrity during flaky connectivity.**
   - Even with retry-safe behavior, UX may not visibly communicate offline preservation.
   - User quote: *“I’m on train Wi‑Fi—did this save or not?”*

4. **History discoverability gap.**
   - “History” label doesn’t clearly promise “my previous check-ins for this KR.”

### Failed intents
- **Intent:** “Reuse last commentary and just tweak one line.”  
  **Failure:** Missing quick “Use previous note” action.  
  **User quote:** *“Why am I retyping this every week?”*

---

## 3) Cross-cutting usability issues

1. **Terminology inconsistency** (`Overview`, `History`, `Review`, per-KR submit vs submit-all).
2. **Trust communication is too implementation-oriented** (LLM/fallback) and not decision-oriented.
3. **Missing mobile safety controls** (undo, confirm destructive/trigger actions, explicit save status).
4. **Insufficient intent shortcuts** for returning users (reuse last inputs, skip unchanged, focused filters).

---

## 4) Prioritized pain points and fixes

## P0 (fix first)

1. **Clarify check-in submission model and state**
   - Problem: users unclear whether they submitted one KR or all.
   - Fix:
     - Use explicit copy: `Save this KR check-in` (per-KR) or `Submit all 4 updates` (batch).
     - Show persistent summary bar: `2 of 5 KRs updated`.
     - Confirmation must include exact scope.
   - Success metric: reduce “duplicate submit / missed KR” errors.

2. **Add mobile-safe action confirmation + undo for manager quick actions**
   - Problem: accidental taps and low trust after nudge/schedule.
   - Fix:
     - Snackbar with scoped message (`Nudge sent to Sarah for KR: Reduce churn`) + `Undo` (10s).
     - Per-card status indicator (`Sent 1m ago`).
   - Success metric: lower repeated taps and support tickets around unintended actions.

3. **Improve metric input guidance for team members**
   - Problem: uncertainty about expected value format.
   - Fix:
     - Pre-input hint: `Expected: number (%), last value: 42%`.
     - Inline validation copy with examples.
   - Success metric: lower validation failures on first attempt.

## P1 (next)

4. **Replace technical AI badge language with confidence-oriented messaging**
   - Problem: `Fallback` undermines trust without context.
   - Fix:
     - Show `Draft quality check passed` + “Generated in ~12s”.
     - Move technical source to expandable details.

5. **Add returning-user accelerators**
   - Fixes:
     - `Use previous note`
     - `Mark no change`
     - quick increment buttons for numeric KRs
   - Success metric: reduced median check-in completion time.

6. **Disambiguate nav labels on mobile**
   - Fix:
     - Rename `History` → `Activity` or `Timeline`.
     - Add subtitle on first open: “Recent saves, check-ins, and changes”.

## P2 (important but can follow)

7. **Role-aware onboarding framing**
   - Add “You’re in Manager mode” / “You’re in Contributor mode” first-run banner.

8. **Digest drill-down affordances**
   - Tap quality chips to filter list (`Stale`, `Blocked`, `Off track`).

---

## 5) Recommended copy changes (high impact, low effort)

- `Generate draft` → `Create OKR draft`
- `Fallback` badge → `Draft ready` (details link for technical source)
- `Submit check-in` → `Save this KR update`
- Success toast: `Saved: KR update shared with your manager`
- Empty state: `No updates yet this week. Start with your highest-priority KR.`

---

## 6) Suggested validation tests after fixes

1. **Task test:** first-time team member submits 3 KR updates on mobile in <5 min.
2. **Task test:** manager triages top 3 risks and sends 2 nudges without ambiguity.
3. **Comprehension test:** users can explain `Overview` vs `Activity` without prompting.
4. **Trust test:** users can tell whether updates were saved, sent, and visible to others.

---

## 7) Bottom line

The core workflow is solid and close to usable, but mobile confidence is currently limited by **ambiguous submission scope**, **weak action feedback**, and **terminology/copy that reflects system internals more than user intent**. Addressing the P0 items should materially improve completion speed, reduce hesitation, and increase trust for both manager and team-member weekly loops.
