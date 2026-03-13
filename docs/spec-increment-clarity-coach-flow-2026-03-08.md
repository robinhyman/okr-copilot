# Product Spec — Increment: Clarity in Coach Create Flow + Cross-Team Ownership

Date: 2026-03-08  
Owner: Product (OKR Copilot)  
References:  
- `docs/development-operating-system.md`  
- `docs/product-increment-delivery-standard.md`  
- `docs/decision-conversational-only-2026-03-08.md`  
- `docs/demo-conversational-only-increment-2026-03-08.md`

## 1) Problem statements

### 1.1 Create with Coach clarity problems
1. **Live draft preview appears before users have enough context**, creating pressure to evaluate an incomplete artifact too early.
2. **Prompt focus panel duplicates conversation value** (assistant already asks follow-ups; side panel and quick actions can feel redundant and noisy).
3. **“Save draft” vs “Continue later” semantics are unclear** because both appear to preserve progress, but user impact is not explicit.
4. **Duplicate “Continue later” actions in the modal** (header + footer) increase cognitive load without clear distinction.
5. **Publish readiness is under-explained** (button says “Publish when ready,” but readiness state model is not obvious to users).

### 1.2 Senior leader cross-team clarity problems
1. In the cross-team rollup, **team ownership is not obvious enough** (team labels are abbreviated/normalized and not tied to accountable owners or full team identity).
2. **Cross-team cards prioritize status mix visuals but not accountability scanning** (leaders need to answer “who owns this?” at a glance).
3. **No explicit ownership cues in supporting overview elements** can cause ambiguity when similar objective/KR names exist across teams.

## 2) User outcomes

### Primary outcomes
- Users understand the conversational create flow stages: discover → refine → save → resume → publish.
- Users can reliably predict what happens when choosing **Save draft** vs **Continue later**.
- Senior leaders can identify **which team owns what** in under 5 seconds per row/card.

### Measurable outcomes (target)
- Reduce user confusion events/questions about save/continue semantics by >=50% in internal demo feedback.
- >=90% of moderated test participants correctly explain Save vs Continue later after one run.
- >=90% of senior-leader test participants correctly identify team ownership for sampled KRs/objectives without assistance.

## 3) In scope

1. Conversational create modal UX/content changes only (no return to wizard; aligns with conversational-only decision).
2. Clear state model and labels for draft persistence actions.
3. Prompt focus panel simplification to remove duplication and improve action relevance.
4. Delayed/conditional live draft preview behavior (progressive reveal).
5. Senior leader overview ownership clarity improvements in rollup presentation and labeling.
6. Supporting copy/tooltips/status text updates needed to make the above unambiguous.

## 4) Out of scope

1. New creation modes, A/B mode experiments, or wizard reintroduction.
2. Major backend schema redesign.
3. New permission model/RBAC changes beyond clarity messaging.
4. Full analytics redesign (only incremental event additions/renames as needed).
5. Broad information architecture rewrite of all overview pages.

## 5) Product requirements

### 5.1 Coach flow structure
- Keep conversational-only entry and resume behavior.
- Introduce explicit visible phases in modal copy:
  1) Understand context,
  2) Build draft,
  3) Finalize and publish.

### 5.2 Live draft preview progressive reveal
- Default behavior: do not show full draft panel immediately on session start.
- Show lightweight placeholder during early discovery (e.g., “Draft will appear after enough detail is captured”).
- Reveal draft only after minimum completeness threshold is met (objective + timeframe + at least 1 KR candidate), or after explicit “Generate draft” action.

### 5.3 Prompt focus panel simplification
- Keep only one source of truth for next-step guidance.
- If assistant has explicit unanswered questions, panel shows those only.
- Quick actions remain but are context-gated (e.g., hide “Make KRs measurable” until at least one KR exists).
- Remove or reduce duplicate phrasing between assistant message and panel.

### 5.4 Explicit action semantics: Save draft vs Continue later

Definitions (normative):
1. **Save draft**
   - Persists a new draft version immediately (`status=saved` unless explicitly marked ready).
   - Creates a durable restore point visible in Drafts with incremented version count.
   - Confirms with deterministic feedback: “Draft saved at <time> (vN).”
2. **Continue later**
   - Closes modal and exits current editing context.
   - If unsaved changes exist since last save, system must perform one of:
     - auto-save as `saved` and inform user, or
     - block close with explicit choice: Save / Discard / Cancel.
   - Must never silently discard unsaved edits.

Interaction policy:
- Keep a single **Continue later** control location unless two controls are intentionally differentiated by label and behavior.
- If two controls are retained, labels must differ (e.g., “Close” vs “Save & close”) and each must declare exact effect.

### 5.5 Publish readiness clarity
- Publish CTA text and helper copy must clearly communicate required readiness.
- If publish is disabled, reason must be visible (e.g., “Need objective + timeframe + at least one measurable KR”).

### 5.6 Senior leader cross-team ownership clarity
- Team rows/cards must show clear, human-readable team names (not only normalized IDs/abbreviations).
- Ownership metadata must be explicit per team entry (minimum: team name; target: team manager/owner label if available).
- Any cross-team list/visual in senior leader rollup must preserve direct team-to-metric mapping without hover dependence.
- Accessibility labels should include team display name + metric context (not only internal `teamId`).

## 6) Acceptance criteria (numbered)

1. **Conversational-only preserved:** All create and resume entry points open conversational coach flow; no user-facing wizard affordance appears.
2. **Preview timing:** On new session start, full live draft preview is hidden until completeness threshold is met or user triggers “Generate draft.”
3. **Discovery clarity:** Before threshold, user sees explanatory placeholder copy about why preview is not yet shown.
4. **Prompt panel non-duplication:** Prompt focus panel only displays unresolved context prompts; it does not repeat already-resolved prompts or mirror assistant text verbatim in the same turn.
5. **Context-aware quick actions:** Quick actions are shown/enabled only when relevant to current draft maturity.
6. **Single-intent close behavior:** “Continue later” behavior is singular and explicit; no duplicate unlabeled controls with identical ambiguous behavior.
7. **Save semantics proof:** Triggering Save draft always creates/persists a new draft version and surfaces confirmation including version indicator.
8. **Continue semantics proof:** Triggering Continue later never loses unsaved edits silently; behavior must be auto-save with notice or explicit save/discard confirmation.
9. **Status/copy clarity:** UI copy distinguishes Save draft (persist version) from Continue later (exit flow, preserving or resolving unsaved work).
10. **Publish clarity:** Disabled publish state always shows clear unmet conditions.
11. **Leader ownership label clarity:** Senior leader rollup displays readable team ownership labels per team segment/row; test users can identify owning team without relying on tooltip.
12. **Accessibility ownership text:** ARIA labels for senior leader rollup elements use readable team names and status meaning.
13. **Persona validation evidence:** Validation includes manager + senior leader scenarios demonstrating corrected clarity behaviors.
14. **Gate compliance:** Increment evidence includes required screenshots/transcripts and passes release:gate + done:proof prior to “done” claim.

## 7) Risks, assumptions, and mitigations

### Risks
1. **Over-suppressing preview** may reduce user confidence if reveal feels delayed.
2. **Auto-save on close** could surprise users expecting explicit control.
3. **Ownership metadata availability** may be limited if backend lacks manager display fields.
4. **Copy-heavy fixes without interaction changes** may not fully resolve confusion.

### Assumptions
1. Existing draft version endpoint remains source of truth for persisted saves.
2. Current role model remains unchanged (manager/team_member/senior_leader).
3. Team display names can be derived or mapped consistently from existing team identifiers.

### Mitigations
1. Use clear progressive disclosure copy + fast reveal once threshold met.
2. Add explicit close-policy messaging and confirmation when unsaved changes exist.
3. Implement deterministic team-name mapping and add owner field opportunistically when available.
4. Validate with short moderated persona walkthrough before final sign-off.

## 8) Rollout notes

1. Ship behind small UX increment branch; no mode experimentation needed.
2. Update/create demo evidence doc for this increment with:
   - coach-flow before/after screenshots,
   - transcript proving non-duplication and action semantics,
   - senior leader ownership readability screenshots.
3. Run required checks (`typecheck`, `build`, scoped tests, `release:gate`, `done:proof`).
4. If telemetry is available, add/adjust events for:
   - draft_preview_revealed,
   - continue_later_with_unsaved_changes,
   - save_draft_success (with version delta),
   - publish_blocked_reason_shown.
5. Monitor first demo cycle for residual confusion and capture follow-up backlog.

## 9) Recommended next increment after this

- Add explicit ownership drill-down from senior leader rollup to team objective/KR list with persistent team context, preserving the same clarity model introduced here.