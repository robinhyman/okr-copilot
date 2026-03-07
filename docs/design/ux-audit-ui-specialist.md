# UX Audit — UI Specialist Review (App.tsx + components + styles)

## Scope reviewed
- `apps/web/src/App.tsx`
- `apps/web/src/components/*` (OverviewDashboard, OverviewSummary, LeaderRollupSnapshot, ManagerActionDigestSnapshot)
- `apps/web/src/styles.css`

## Executive summary
The product has a solid foundation (clear core routes, useful role-based snapshots, visible progress visuals), but several **workflow-critical controls are missing or ambiguous**. Most risk is around lifecycle clarity (draft/objective/cycle states), onboarding/team context, and mobile/action ergonomics.

---

## P0 (must fix now)

### 1) Missing destructive lifecycle controls for drafts (delete/discard)
**Issue:** Draft list supports resume only; modal offers save/continue/publish but no delete/discard/archive.
**Risk:** Users accumulate stale drafts, lose confidence in state, and can’t clean workspace.
**Fix:**
- Add explicit actions: **Delete draft**, **Archive draft**, **Duplicate draft**.
- Add confirmation modal with clear consequences and undo/toast.
- Show draft owner + last edited + status in list for safer deletion.

### 2) Objective lifecycle is incomplete (no done/archive/end-of-life actions)
**Issue:** Objectives/KRs are visualized, but no visible “Mark objective done”, “Archive objective”, “Reopen”, or lifecycle timeline.
**Risk:** Teams can publish but not close loops; overview becomes cluttered with old objectives.
**Fix:**
- Add objective-level lifecycle actions and status chips (Active / Done / Archived).
- Add filters: Active only (default), Include done, Include archived.
- Add completed date and owner to objective cards.

### 3) Cycle definition is unclear (start/end boundaries missing)
**Issue:** Timeframe is plain text; no cycle object/selection in UI.
**Risk:** Inconsistent cycle semantics across teams; reporting is hard to trust.
**Fix:**
- Introduce explicit cycle selector (e.g., Q2 2026) with immutable start/end dates.
- Show cycle in nav header and all relevant panels.
- Validate draft publish against selected cycle.

---

## P1 (high priority)

### 4) IA/navigation clarity needs stronger orientation
**Issue:** Left nav is minimal (Overview/OKRs/Check-ins) but lacks page context, active workspace/team indicator, and route intent.
**Risk:** Users (especially role-switching demos) lose orientation.
**Fix:**
- Add top context bar: Team, Role, Cycle, current page subtitle.
- Rename “OKRs” route to task-oriented label (e.g., **Plan OKRs**).
- Move “Demo persona” into a dedicated workspace switcher with warning badge (“Demo mode”).

### 5) Onboarding and team setup are absent
**Issue:** Empty states are passive (“No key results yet…”), no guided first-run path.
**Risk:** New managers don’t know required sequence (team -> cycle -> draft -> publish -> check-in).
**Fix:**
- Add first-run checklist and guided CTA stack:
  1. Set team/cycle
  2. Create first objective
  3. Add KR owners
  4. Schedule first check-in
- Convert empty states into action-first cards.

### 6) Mobile ergonomics: interaction density and modal behavior
**Issue:** Desktop-first layout + large multi-column modal; many small actions (emoji-only KR check-in trigger) and dense card internals.
**Risk:** Tap accuracy and comprehension degrade on mobile.
**Fix:**
- Replace emoji-only trigger with full button label on touch (`Check in`).
- Sticky bottom action bar in modals (Save/Publish/Close).
- Reduce nested panel density and increase vertical rhythm for small screens.

### 7) Accessibility gaps (keyboard/focus/semantics)
**Issue:** Some controls rely on hover reveal (`.kr-checkin-label`), focus management for modal not evident, status messages are mostly visual/muted.
**Risk:** Keyboard and assistive tech users miss controls/state updates.
**Fix:**
- Ensure modal focus trap + restore focus on close + Esc support.
- Keep control labels always visible (not hover-only).
- Use `aria-live` for save/publish/check-in success/errors.
- Improve color contrast for muted text and status pills where needed.

---

## P2 (important polish)

### 8) Consistency of labels/state language
**Issue:** Mixed terminology: “at risk” vs “needs attention”, “Continue later” appears twice, status copy varies by panel.
**Fix:**
- Create shared vocabulary map and enforce across components.
- Standardize action labels (Save draft, Close, Publish) and status chips.

### 9) Check-ins page lacks actionable grouping
**Issue:** Flat chronological list with limited triage tools.
**Fix:**
- Group by objective/KR with collapsible sections.
- Add quick filters (mine/team, has blocker, low confidence, stale).

### 10) Draft workflow clarity could be improved
**Issue:** Coach modal has 3 columns with competing attention (chat/prompts/preview) and weak progression cues.
**Fix:**
- Add step indicator (Discover → Refine → Review → Publish).
- Highlight current required action and lock non-relevant actions contextually.

---

## Suggested implementation order
1. **P0 lifecycle controls** (draft delete/archive, objective done/archive, cycle model in UI)
2. **P1 onboarding + IA orientation** (context bar, guided empty states)
3. **P1 accessibility/mobile corrections** (labels, focus, sticky actions)
4. **P2 consistency + triage improvements**

## Quick wins (1–2 days)
- Add visible `Delete draft` with confirm dialog.
- Add objective status chip + filter for Active/Done/Archived.
- Make KR check-in button text-visible at all breakpoints.
- Add `aria-live` region for status updates.
- Standardize wording: choose one of “At risk” vs “Needs attention.”
