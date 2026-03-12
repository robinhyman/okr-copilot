# UI Spec — Team Grouping + Coach Loop Mitigation + Chat Input UX

Date: 2026-03-08  
Owner: UI/UX  
Status: Ready for implementation

## Inputs reviewed
- `apps/web/src/App.tsx`
- `apps/web/src/components/LeaderRollupSnapshot.tsx`
- `docs/demo-clarity-coach-flow-increment-2026-03-08.md`
- Latest local coaching artifacts (Postgres draft lifecycle data):
  - `okr_draft_sessions` latest active session: `id=6`, `team_product coach draft`
  - `okr_draft_versions` v1→v24 show long question-only run with repeated missing-context themes (scope, outcome, why-now, business problem)
  - Session contains 24 chat versions and 2 manual saves, with scope re-asked after save

---

## 1) Flow summary (next increment)

### A. Senior leadership overview: explicit team ownership hierarchy
Goal: Let senior leaders scan cross-team status by owner hierarchy first, then risk.

**Target interaction model**
1. Keep current risk grouping (`Needs attention now`, `Stable teams`).
2. Within each group, render a consistent hierarchy row:
   - **Org owner node** (e.g., VP Product)
   - **Team name** (e.g., Product Team)
   - **Team code** (`team_product`) as secondary traceability
   - **Health mix bar** + KR count
3. Add sortable toggles (default remains risk-first):
   - `Risk (default)`
   - `Owner hierarchy`
4. Add compact filter chips above list:
   - `All teams` / `Needs attention` / `Stable`
   - optional owner filter when >4 teams

**Why:** current component already improves naming/owner labels, but hierarchy is implicit. This increment makes ownership chain explicit and scannable.

---

### B. Coach loop mitigation: interaction-level controls
Goal: Reduce perceived “looping” when assistant stays in questions mode.

### Transcript symptom summary (from latest local artifacts)
From `draft_session_id=6` (latest local run):
- 20+ consecutive `mode=questions` turns before user-visible draft progression.
- Repeated semantic asks around same fields (why-now, problem, beneficiary, scope).
- Scope question reappears after later turn (`v23`) causing perceived reset.
- User can save while coach still unresolved, but no “completion map” to explain remaining gaps.

### UX mitigations
1. **Progress contract above conversation**
   - Show a 3-step mini tracker: `Scope → Outcome framing → Measurement`.
   - Highlight current step and remaining required fields count.

2. **Missing-context checklist chip rail**
   - Render top 1–3 unresolved fields as chips (e.g., `Define primary outcome`, `Confirm why now`).
   - Clicking chip inserts a suggested answer scaffold into input.

3. **Loop interrupt affordance (explicit user control)**
   - Add secondary action: `Generate best-possible draft with assumptions` when coach is still in questions mode after N turns (N=4 without entering refine).
   - On invoke, coach creates draft + assumption banner (editable).

4. **Re-ask guard at UX layer**
   - If assistant asks semantically similar question category twice within last 4 turns, show inline label: `We still need this to improve draft quality` and one-tap answer template.
   - Prevents “why are you asking me this again?” confusion.

5. **Mode visibility**
   - Replace subtle status text with explicit badge: `Question mode` or `Refining draft`.

---

### C. Suggested-input chips placement
Goal: Make suggested actions discoverable and near typing action.

**Current:** shortcut buttons are in separate “Prompt focus” panel.  
**Change:** when relevant, show suggested-input chips directly **above chat input composer** in conversation pane.

**Behavior**
- Show up to 3 chips, priority order:
  1. Missing-context completion chip (from unresolved checklist)
  2. `Generate draft now`
  3. `Make KRs measurable` (only if KR exists)
- Chips hide while coach is thinking.
- Chip tap should:
  - prefill input (editable),
  - focus input,
  - not auto-send unless configured action chip says “Send”.

---

### D. Keyboard UX (chat composer)
Goal: align with standard chat behavior.

**Rules**
- `Enter` => send message (if input has non-whitespace and coach not thinking).
- `Shift+Enter` => newline in input.
- `Cmd/Ctrl+Enter` => also send (power-user parity).
- On successful send:
  - clear input,
  - preserve focus in input,
  - announce send status via polite live region.

**Guardrails**
- If sending disabled, `Enter` does not submit and instead announces reason (e.g., “Coach is thinking”).
- Respect IME composition events (do not send while composing East Asian text).

---

## 2) UI states checklist

## Senior leader rollup
- Loading: skeleton cards for donut/list/trend.
- Empty: “No team rollup available yet” + last refresh hint.
- Success:
  - risk grouping visible,
  - owner hierarchy visible,
  - sort/filter controls visible.
- Error: inline retry and non-blocking fallback summary counts.

## Coach conversation/composer
- Idle (ready to type)
- Coach thinking (chips + send disabled)
- Questions mode (progress + unresolved chips visible)
- Refine mode (draft-focused chips)
- Loop risk state (repeat-category helper + best-possible-draft action)
- Input validation (blank/disabled send)
- Network/API failure (retry last send)

## Suggested-input chips
- Hidden when no relevant suggestion.
- Visible and keyboard focusable when relevant.
- Disabled during thinking.
- Overflow wraps to second line without pushing send button off-screen (mobile).

---

## 3) Accessibility notes

1. **Hierarchy semantics**
   - Team list uses `<ul>/<li>` with clear label text including owner + team name.
   - Sort/filter controls are native buttons with `aria-pressed` states.

2. **Status announcements**
   - Use one `aria-live="polite"` region for send status, loop-helper notices, and mode transitions.
   - Avoid duplicate announcements from multiple regions.

3. **Keyboard operability**
   - Chips reachable via Tab in logical order: history → chips → input → send.
   - Enter/Shift+Enter behavior documented in helper text (`aria-describedby`).

4. **Color + non-color cues**
   - Risk and mode use icon/text in addition to color (e.g., `At risk`, `Question mode`).

5. **Focus management**
   - After chip click, focus stays in input with caret at end of inserted text.
   - After send, focus returns to input and message appears in reading order.

6. **Reduced motion**
   - Typing indicator respects `prefers-reduced-motion`.

---

## 4) UX acceptance criteria (measurable)

## Leadership hierarchy view
1. For senior leader persona, every visible team row shows: owner label, team display name, team code, KR total. (100% rows)
2. Default sort remains risk-first; switching to owner hierarchy updates order within 300 ms for <=30 teams.
3. User can identify owner for any team in <=1 tap/0 scroll from first viewport for top 5 teams.

## Coach loop mitigation
4. When `questions` mode persists for 4 consecutive assistant turns, loop-interrupt action appears.
5. In sessions with repeated missing-context categories, unresolved checklist chips update turn-by-turn and never show already-satisfied fields.
6. Scope re-ask event (same category within 4 turns) shows helper explanation and one-tap scaffold.
7. Median turns to first draft preview decreases by 25% from current baseline (baseline from draft_session analytics; target after release).

## Suggested-input chips above composer
8. Relevant chips render directly above input in conversation pane (not only side panel).
9. Chip click prefills input and focuses composer in <=100 ms.
10. `Make KRs measurable` chip appears only when draft contains >=1 KR.

## Keyboard behavior
11. Enter sends exactly one message when enabled; Shift+Enter inserts newline; Cmd/Ctrl+Enter sends.
12. No accidental send during IME composition (0 repro in QA scenario pack).
13. After send, input remains focused and cleared; screen reader announces “Message sent”.

---

## 5) Implementation notes for handoff
- `App.tsx`: add composer-level chips section above input, keyboard handlers, and loop-state derivation from recent turn categories.
- `LeaderRollupSnapshot.tsx`: add owner-hierarchy sort option + controls while preserving existing risk grouping default.
- Telemetry additions recommended:
  - `coach_loop_interrupt_shown`
  - `coach_loop_interrupt_clicked`
  - `suggested_chip_clicked` (chip type)
  - `chat_enter_send_used` / `chat_shift_enter_newline_used`

This increment should optimize perceived control and forward motion without weakening coaching rigor.