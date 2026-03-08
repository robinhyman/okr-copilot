# A/B Experiment Delivery — UI/UX Spec

Date: 2026-03-08  
Owner: UI/UX  
Scope: Conversational OKR Coach flow (`/okrs` route + coach modal)

---

## 1) Flow summary

This spec defines how users are enrolled into **Variant A** or **Variant B** for the coach flow, how they can switch/escape safely, and how state/telemetry/accessibility are handled.

Primary UX goals:
1. Keep first-run friction low.
2. Make experiment state explicit but non-intrusive.
3. Provide a safe escape hatch to stable behavior.
4. Preserve progress when switching where feasible.

---

## 2) Variant A/B entry points

### Entry point inventory

1. **Primary CTA on OKRs screen**
   - Current control: `Create OKR with Coach`
   - Experiment behavior:
     - On click, route through assignment resolver (`A` or `B`).
     - Open modal variant shell based on assignment.

2. **Resume from Drafts list**
   - Current control: draft row button (`{title} · {status} · v{n}`)
   - Experiment behavior:
     - Preserve draft’s originating variant when available (`draft.variant`), else use current assignment.
     - Show a subtle chip in modal header: `Experience A` / `Experience B`.

3. **Deep-link/open session action (future-safe)**
   - If session is opened from URL or external action, variant is restored from session metadata.

### Assignment rules (UX-facing)

- Assignment happens once per user/team context and is sticky for the experiment window.
- Do not randomize on every modal open.
- If assignment service fails, default to **control fallback (A)** and continue silently.

### Visual labeling

- In-modal label (non-blocking): `Experiment: Experience A` or `Experiment: Experience B`.
- Keep internal wording (“A/B”) out of user-facing copy except in debug/admin mode.

---

## 3) Copy + affordances for switch / escape hatch

### Principle
Users should never feel trapped in an unstable experience. Switching must be explicit, reversible, and data-safe.

### Affordances

1. **Header tertiary action** (new)
   - Label: `Switch experience`
   - Placement: modal header, next to `Continue later`.
   - Opens lightweight confirmation popover/modal.

2. **Emergency escape-hatch** (new)
   - Label: `Use stable experience`
   - Placement: within switch popover and error state banners.
   - Function: forces control variant for the active session and subsequent opens (until experiment end or manual reset).

3. **Contextual banner after switch**
   - Copy: `You’re now using Experience B. Your draft has been preserved.`
   - If any non-portable UI state resets:
     - `Some in-progress prompt suggestions were reset. Your draft content is safe.`

### Confirmation copy

**Switch dialog title:** `Switch experience?`  
**Body:** `We’ll keep your draft content. You may see a different layout and guidance style.`

Buttons:
- Primary: `Switch now`
- Secondary: `Cancel`
- Tertiary link-style: `Use stable experience`

### Escape-hatch error copy

- Inline banner (on repeated failure/crash/retry threshold):
  - `This experience is having trouble right now.`
  - CTA: `Use stable experience`

---

## 4) Progress/state indicators

All variants must expose complete state coverage:

### Global/session states

1. **Idle (pre-start)**
   - Existing: `Create OKR with Coach`
   - Add helper text: `Guided session with draft preview.`

2. **Starting session**
   - Existing: `Starting coach…`
   - Keep skeleton/placeholder in conversation + preview panes.

3. **Active conversation**
   - Existing typing indicator (`Coach: thinking…`)
   - Add elapsed threshold treatment:
     - >8s: show muted `Still working…`
     - >15s: show secondary action `Retry response`

4. **Draft-ready**
   - Existing preview pane populated.
   - Add clear status chip in footer:
     - `Draft in progress` / `Ready to publish` (derived from coach/draft state).

5. **Saving**
   - On Save draft click: button enters loading state `Saving…`; prevent duplicate submit.

6. **Publishing**
   - Publish button loading state `Publishing…`; block close only while request in flight.

7. **Success**
   - Toast/banner:
     - Save: `Draft saved.`
     - Publish: `Draft published to OKRs.`

8. **Error**
   - Inline error at action locus with retry CTA.
   - Network/coach errors must not clear conversation history or draft preview.

### Experiment-related states

- `Assignment pending` (very short): no flash of wrong variant.
- `Variant loaded` (silent).
- `Switched variant` confirmation banner.
- `Escape-hatch active` chip: `Stable experience on`.

---

## 5) Accessibility requirements

Minimum conformance target: WCAG 2.2 AA patterns for this flow.

1. **Keyboard and focus**
   - Modal has proper focus trap.
   - Initial focus lands on modal title or first actionable control.
   - On close, focus returns to invoking control (`Create…` button or selected draft row).
   - `Esc` closes modal unless a blocking in-flight publish is active.

2. **Semantics**
   - Keep `role="dialog"` + `aria-modal="true"`.
   - `Switch experience` and `Use stable experience` must be real `<button>` elements (not divs).

3. **Announcements**
   - Live region for status updates (`saving`, `published`, `error`, `switched`).
   - Avoid spammy announcements for typing dots.

4. **Color/contrast**
   - Variant chips, muted status text, and banners must meet AA contrast.
   - Do not encode variant/state by color alone; include text labels/icons.

5. **Motion and timing**
   - Respect `prefers-reduced-motion` for typing animation and transitions.
   - No auto-dismiss critical errors before user can act.

6. **Target size + mobile ergonomics**
   - All top-level controls (Switch, Continue later, Save, Publish) min 44x44 CSS px hit area.

---

## 6) Telemetry touchpoints from UI

Track at UI boundary with `experiment_id`, `variant`, `team_id`, `user_id`, `session_id`, `draft_id` (when present).

### Exposure and assignment
- `ab_assignment_resolved`
  - props: `{ experiment_id, variant, source: 'sticky'|'new'|'fallback' }`
- `ab_exposure`
  - fire once per modal open after variant render.

### Entry events
- `coach_entry_clicked`
  - props: `{ entry_point: 'primary_cta'|'resume_draft'|'deep_link', variant }`
- `coach_modal_opened`
  - props: `{ variant, open_latency_ms }`

### Interaction + state
- `coach_message_sent`
- `coach_response_received`
  - include latency + response source metadata.
- `draft_saved_clicked` / `draft_saved_success` / `draft_saved_error`
- `draft_publish_clicked` / `draft_publish_success` / `draft_publish_error`

### Experiment controls
- `ab_switch_initiated`
- `ab_switch_confirmed`
- `ab_switch_cancelled`
- `ab_escape_hatch_used`
  - include reason: `manual`, `error_recovery`, `performance_timeout`.

### Outcome + guardrail signals
- `coach_modal_closed`
  - props: `{ close_type: 'continue_later'|'x'|'escape'|'publish_success', unsaved_changes }`
- `coach_session_abandoned`
  - inferred if no save/publish within threshold.

---

## 7) UI states checklist (implementation-ready)

- [ ] Assignment resolves before modal content paint.
- [ ] Variant chip shown in header (A/B as friendly labels, not technical jargon).
- [ ] Switch experience action available and keyboard accessible.
- [ ] Escape-hatch available from switch UI + failure banner.
- [ ] Save/publish loading + disabled duplicate submits.
- [ ] Error states preserve user content and show retry.
- [ ] Status updates announced via aria-live.
- [ ] Focus restore on modal close.
- [ ] Telemetry emitted for exposure, switch, escape, and key conversion points.

---

## 8) UX acceptance criteria

1. User can start from `/okrs` CTA and get a deterministic variant without perceptible flicker.
2. User can resume existing draft and stay in consistent variant context.
3. User can switch variants in <=2 clicks with clear confirmation and no draft loss.
4. User can force stable experience from at least two locations (switch dialog + error banner).
5. All key lifecycle states (loading, thinking, save/publish success, errors) are visible and understandable.
6. Keyboard-only user can complete start → message → save flow.
7. Screen reader receives meaningful state change announcements.
8. Product analytics can compute exposure, engagement, switch rate, escape-hatch rate, and publish conversion by variant.

---

## 9) Screenshots / wireframe notes list

Use existing wireframes as baseline and add A/B annotations:

1. `docs/wireframes/01_create_entry.svg`
   - Annotate entry CTA with assignment hook and no-flicker requirement.
2. `docs/wireframes/02_coach_conversation.svg`
   - Annotate header area for variant chip + switch control.
3. `docs/wireframes/03_draft_review_refine.svg`
   - Annotate draft-ready indicators and save/publish states per variant.
4. `docs/wireframes/04_drafts_and_publish.svg`
   - Annotate resume path and variant persistence from draft list.
5. New lightweight mock note (to create): `ab-switch-popover` state
   - Includes switch confirmation + `Use stable experience` affordance.
6. New lightweight mock note (to create): `ab-error-banner` state
   - Includes fallback copy + escape-hatch CTA.

---

## 10) Risks and edge cases

- Draft created in variant B then resumed when B unavailable: must auto-fallback to A with non-alarming notice.
- Mid-turn switch while coach response is pending: block switch until response resolves or user cancels request.
- Assignment service timeout: default to A and log fallback telemetry.
- Do not expose technical experiment IDs in normal user copy.
