# Clarity Upgrade Spec — Coach Create Flow + Senior Leader Cross-Team View

Date: 2026-03-08  
Owner: UI/UX  
Scope: `/okrs` coach modal and `/overview` senior leader rollup components  
Inputs reviewed:
- `apps/web/src/App.tsx`
- `docs/design/ab-experiment-ui-spec-2026-03-08.md`
- `docs/demo-conversational-only-increment-2026-03-08.md`

---

## 1) Problem summary (current clarity/cognitive load issues)

### Create-with-Coach modal
1. **Live draft preview appears too early**
   - Panel is always visible, even before enough context exists.
   - Produces low-signal placeholder states (“Draft preview building…”) that compete with conversation focus.

2. **Prompt focus panel has duplicated guidance**
   - Simultaneously shows:
     - assistant conversation,
     - “Prompt focus” explanatory text/list,
     - quick-action chips.
   - The explanatory text duplicates what the coach already says in chat.

3. **CTA semantics are ambiguous**
   - “Continue later” appears in header and footer with same styling as primary progress actions.
   - “Save draft” vs “Continue later” contract is not explicit (save state vs close-only behavior).

4. **Action hierarchy is weak**
   - Publish CTA (“Publish when ready”) competes visually with deferral/close actions.

### Senior leader cross-team view
5. **Team ownership labeling is unclear**
   - Team labels derive from `teamId` (`team_product` -> `PRODUCT`) and lose human-readable ownership context.
   - No owner/accountable person signal, no display-name mapping, no stable ordering by risk or ownership.

6. **Cross-team scanability can be improved**
   - Team bars are dense; no explicit rank/sort rationale.
   - Trend shows aggregate movement but weakly connects to team-level accountability.

---

## 2) Before/After interaction model

### A. Create-with-Coach flow

#### Before
1. User opens “Create OKR with Coach”.
2. Sees three equal-weight panels immediately:
   - Conversation
   - Prompt focus
   - Live draft preview (often empty/incomplete)
3. User must infer whether to keep chatting or start editing preview.
4. Footer shows Save/Continue later/Publish without clear state contract.

#### After
1. User opens “Create OKR with Coach”.
2. **Stage 1: Guided conversation only (primary focus)**
   - Conversation panel full emphasis.
   - Prompt focus shown in compact mode: shortcut chips + optional single-line hint.
   - Draft preview hidden (deferred).
3. System evaluates draft readiness threshold after each assistant turn.
4. **Stage 2: Draft available**
   - “Draft preview” panel appears with transition and readiness badge.
   - User can refine via chips or chat; changes sync to preview.
5. Footer actions adapt by state:
   - Draft not ready: `Continue later` (close only).
   - Draft ready: `Save draft`, `Continue later`, `Publish` (if role/status allows).

### B. Senior leader cross-team view

#### Before
- Team list uses transformed IDs (e.g., PRODUCT, SALES).
- No explicit ownership metadata.
- Visual hierarchy centers status bars over ownership accountability.

#### After
- Each team row includes:
  - **Team display name** (e.g., “Product Team”)
  - **Ownership label** (“Owner: VP Product” or “Manager: A. Smith”)
  - **Team code** secondary (e.g., `team_product`) for traceability
- Rows default sorted by risk severity (Off-track desc, then At-risk desc).
- Top risk teams pinned with “Needs attention now” grouping.

---

## 3) Draft preview visibility rules (defer until ready)

### Readiness states
- `NOT_STARTED`: no assistant response yet.
- `DISCOVERY`: context gathering in progress.
- `DRAFT_CANDIDATE`: system has minimally coherent draft but confidence below threshold.
- `DRAFT_READY`: threshold met; preview shown.

### Visibility rules
1. Hide preview panel when `NOT_STARTED | DISCOVERY`.
2. Keep hidden for `DRAFT_CANDIDATE` unless user explicitly clicks “Show early draft” (secondary, optional).
3. Auto-show when `DRAFT_READY`.
4. Once shown, keep visible for session (unless user manually collapses).

### Suggested readiness threshold (UX contract)
Preview is auto-shown only when all are true:
- Objective text non-empty and >= 8 meaningful words.
- Timeframe present.
- At least 2 key results with:
  - title present,
  - numeric baseline + target,
  - unit present.
- Coach indicates mode = refine OR returns no “missing context” prompts.

### Copy for hidden state
- Panel placeholder (not rendered as full panel):
  - `Draft preview will appear once we have enough context.`
- Optional helper beneath chips:
  - `Tip: answer one more coach question to unlock draft preview.`

---

## 4) Prompt focus panel simplification

### Keep
- Shortcut chips (high utility):
  - “Generate draft”
  - “Make KRs measurable”
- Missing-context prompts list only when non-empty.

### Remove/replace
- Remove persistent verbose fallback text:
  - “No missing-context prompts right now.”
- Replace with concise line only when needed:
  - `You’re on track — use a shortcut or reply to coach.`

### Layout behavior
1. If `coachPrompts.length > 0`: show titled list + chips.
2. If `coachPrompts.length === 0`: hide list container; keep only chips row + one-line hint.
3. Keep panel width compact; prioritize conversation viewport height.

---

## 5) Save draft vs Continue later — UX contract

### Intent definitions
- **Save draft** = persist current draft snapshot/version to backend (`status: saved` or `ready`); confirm success.
- **Continue later** = close modal now, preserving already-saved state only; does **not** create a new save.

### Behavior rules
1. `Continue later` always available.
2. If unsaved changes exist and user taps `Continue later`:
   - confirmation sheet:
     - Title: `Leave without saving recent changes?`
     - Body: `Your last saved draft is safe. Recent edits will be lost.`
     - Actions: `Save and close` (primary), `Close without saving` (destructive-secondary), `Cancel`.
3. Keep only one “Continue later” control in footer (remove header duplicate).
4. Rename Publish CTA to **“Publish draft”** (state-dependent helper text below button can say “when ready”).

### Copy changes
- `Save draft` -> keep label.
- `Continue later` -> keep label, but with explicit unsaved-change confirmation.
- `Publish when ready` -> `Publish draft`.
- Success toast:
  - Save: `Draft saved.`
  - Close after save-and-close: `Draft saved. You can continue later from Drafts.`

---

## 6) Senior leader team-labeling + visual hierarchy spec

### Data/label model
For each team row, display:
1. **Primary:** `teamDisplayName` (human readable, title case).
2. **Secondary:** `Owner: {ownerName or role}`.
3. **Tertiary muted:** `teamId` code.

If owner unknown:
- show `Owner: Unassigned` badge (warning style).

### Sorting and grouping
Default sort:
1. `offTrack` desc
2. `atRisk` desc
3. `teamDisplayName` asc

Group sections:
- `Needs attention now` (offTrack > 0 or atRisk above threshold)
- `Stable teams`

### Row hierarchy
- Left: team + owner metadata.
- Middle: stacked status bar with explicit percentages.
- Right: KR count + trend delta chip (`↑2 pts on-track` / `↓3 pts on-track`).

### Team naming transformation rule
Replace current `formatTeamName(teamId)` uppercase conversion with mapping resolver:
- `team_product` -> `Product Team`
- `team_sales` -> `Sales Team`
- `team_ops` -> `Operations Team`
Fallback: safe title-case slug formatter, not all-caps.

---

## 7) Additional clarity/confusion hotspots identified

1. **Duplicate deferral control**
   - Continue-later appears in header and footer; creates accidental close risk.

2. **Status messaging density**
   - Top bar shows state + perf metrics + status in same row, increasing noise.
   - Recommendation: move perf diagnostics behind debug flag/non-prod only.

3. **Chat input placeholder ambiguity**
   - “Answer the coach...” implies question-only response; users may want freeform updates.
   - Recommended: `Reply or ask for changes…`.

4. **Draft list row semantics**
   - Draft row button includes title/status/version in one long line; low scannability.
   - Recommend two-line row: title primary; metadata chips secondary.

---

## 8) Accessibility notes

1. **Modal action clarity + keyboard**
   - Single Continue-later control reduces tab-stop duplication.
   - Unsaved-changes confirm must be keyboard-trappable and ESC dismissible.

2. **Live region hygiene**
   - Keep only one polite `aria-live` region for status changes.
   - Do not repeatedly announce typing animation dots.

3. **Deferred preview discoverability**
   - Provide text announcement when preview becomes available:
     - `Draft preview is now ready.`

4. **Color independence in team rollup**
   - Keep labels + numeric values for each segment; never rely on color-only bars.

5. **Readable team labels**
   - Avoid ALL CAPS team names for dyslexia/readability concerns.

---

## 9) Measurable UX acceptance criteria

### Create-with-Coach clarity
1. **Preview deferral correctness**
   - In >= 95% of new sessions, preview remains hidden until readiness threshold is met.
2. **Reduced early cognitive load**
   - Median time-to-first-user-reply decreases by >= 15% vs pre-change baseline.
3. **Prompt panel efficiency**
   - Shortcut chip usage rate increases by >= 10% without increasing abandonment.
4. **CTA understanding**
   - Unsaved-close confirmations triggered in sessions with unsaved edits; accidental-loss complaints in QA = 0.
5. **Action completion**
   - Save success rate >= 98% of save attempts; publish misclick/backout events reduced by >= 20%.

### Senior leader cross-team clarity
6. **Ownership visibility**
   - 100% of team rows show owner status (`Owner: Name` or `Owner: Unassigned`).
7. **Risk-first scanning**
   - In usability test, leaders identify top 2 risk teams in <= 10 seconds (80% of participants).
8. **Label comprehension**
   - Team name recognition accuracy >= 95% (no confusion from ID/uppercase transforms).

### Accessibility
9. Keyboard-only user can complete:
   - open modal -> send message -> save draft -> close modal.
10. Screen reader announces:
   - session start, coach response, preview ready, save success/failure.

---

## 10) Implementation notes (non-blocking)

- Keep conversational-only architecture per increment note; do not reintroduce experiment switch affordances.
- Add a small derived `draftReadiness` selector in UI state layer from existing `activeDraft`, `coachPrompts`, and assistant mode metadata.
- Preserve API compatibility: no required backend schema change for this UX pass, except optional team metadata enrichment for owner display.
