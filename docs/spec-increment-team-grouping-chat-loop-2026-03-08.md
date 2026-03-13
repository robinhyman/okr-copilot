# Product Spec — Team Grouping + Coaching Loop + Chat Input UX Increment (2026-03-08)

References:
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`
- `docs/demo-clarity-coach-flow-increment-2026-03-08.md`
- `apps/web/src/App.tsx`

## Problem statements

1. **Senior leader view still does not group OKRs by team in the main objective/OKR area.**
   - Current `/overview` renders `OverviewSummary` objective cards from `metrics.byObjective` without team labels/grouping.
   - `App.tsx` currently strips team context before calling `buildGroupedOverviewMetrics`.
   - Result: senior leaders see cross-team objectives blended together, reducing accountability and scanability.

2. **Coaching conversation can get stuck in a question loop.**
   - In latest local draft session (`okr_draft_sessions.id=6`, `team_product`, updated `2026-03-08T21:40:18Z`), versions `v1–v24` are almost entirely `mode=questions` with repeated scope/strategy prompts and no meaningful draft progression (objective remains fallback: “Define a measurable outcome for this period”, timeframe unchanged, KR count fixed at 1).
   - This creates user fatigue and prevents transition from discovery to refinement.

3. **Suggested-input chips are not positioned where users type.**
   - Suggested actions/questions currently appear in a separate “Prompt focus” panel and not directly above the text entry field.
   - Users must visually context-switch between prompt suggestions and input controls.

4. **Keyboard send behavior is missing expected chat affordance.**
   - Input currently requires clicking Send.
   - Enter-to-send and Shift+Enter newline are not implemented.

---

## Desired outcomes

1. Senior leaders can quickly inspect OKR health **by team** in the main overview objective section (not only rollup snapshot).
2. Coaching flow transitions to draft refinement reliably, with anti-loop protections and visible progress.
3. Suggested-input chips appear immediately above the chat input and can be inserted/sent with one click.
4. Chat composer follows standard behavior: **Enter = send**, **Shift+Enter = newline**.

Success indicators:
- Reduced repeated question turns before first substantive draft.
- Higher rate of users reaching preview-unlocked and save-ready states.
- Fewer abandoned sessions due to coaching fatigue.

---

## In scope

1. **Team-grouped objective presentation for senior leaders (overview objective area)**
   - Preserve existing manager/team-member views.
   - For senior leader role, group objective cards under team headers (human-readable team names).
   - Show team context on each objective card (header/subheader badge), and maintain KR check-in actions.

2. **Coaching anti-loop guardrails (API + UI integration)**
   - Add loop-detection logic using recent assistant prompts + unresolved/mutable missing-context set.
   - Escalate from repeated discovery prompts to one of:
     - forced synthesis attempt with explicit assumptions/TBDs,
     - constrained multiple-choice prompt,
     - explicit “confirm to proceed with assumptions” transition.
   - Persist loop signals in metadata for observability (e.g., `loopDetected`, `loopStage`, `repeatCount`).

3. **Suggested-input chips above composer**
   - Render contextual chips directly above text entry when clear choices exist (from `questions` and/or controlled shortcuts).
   - Clicking chip inserts/sends deterministic text via existing `sendChatTurn` flow.

4. **Composer keyboard behavior**
   - Replace single-line input with multiline composer.
   - Enter submits when not composing/shifted.
   - Shift+Enter inserts newline.
   - Preserve disabled states during coach thinking/session start.

5. **Instrumentation updates**
   - Add product events for chip usage, enter-send usage, and loop escape path.

---

## Out of scope

1. Full redesign of leader rollup cards or trend visualization.
2. New OKR ontology/rewriting the entire coaching system prompt architecture.
3. Multi-OKR batch coaching in one thread.
4. Cross-session transcript reconstruction beyond existing stored draft/version metadata.

---

## Loop diagnosis findings (latest transcript/state evidence)

Source inspected: local Postgres tables `okr_draft_sessions`, `okr_draft_versions`, `product_events`.

### Evidence summary
- Latest active test thread: `draft_session_id=6`.
- 25 versions total; majority are `source='chat'`, `mode='questions'`.
- Assistant summaries repeatedly ask adjacent discovery questions (scope, beneficiary, why-now, business problem, baseline/target), with little state advancement.
- Draft payload remains largely static across turns:
  - objective: fallback placeholder,
  - timeframe: `Q2 2026`,
  - key results: constant count (1).
- After a manual save (`v22`), questioning pattern effectively restarts (`v23` asks scope again).

### Likely root causes

1. **Strict gating to questions mode**
   - In `OpenAiDraftProvider.continueConversation`, mode is forced to `questions` while missing checklist fields exist.
   - Missing checklist includes broad fields (strategicWhy, baseline, target, constraints, timeframe) that may not converge quickly in free-form chat.

2. **No convergence strategy for partially known context**
   - System can keep asking for “one more missing item” without fallback synthesis with assumptions.
   - There is no max-question budget or mandatory progression threshold.

3. **Weak memory of answered fields across turns**
   - Context extraction relies on regex over recent message text and may fail to normalize semantically equivalent answers.
   - Result: previously answered concepts can reappear as missing.

4. **No loop-aware turn policy**
   - `ensureNonLoopingAssistantMessage` only avoids verbatim duplication, not semantic repetition.
   - Different phrasings of same unresolved theme still produce loop-like UX.

5. **UI placement contributes to loop fatigue**
   - Suggested prompts are visually separated from composer, reducing guided responses and increasing drift.

---

## Acceptance criteria

1. **Senior leader team grouping (overview objective section)**
   1.1 For senior leader persona, objective cards are rendered under team group headings.
   1.2 Each group heading uses readable team name and includes team code fallback.
   1.3 No objective from Team A appears under Team B.
   1.4 Manager and team-member views remain unchanged.

2. **Coaching loop prevention**
   2.1 If semantically similar discovery prompts repeat beyond threshold (e.g., 2 consecutive thematic repeats), backend sets loop metadata (`loopDetected=true`, reason).
   2.2 When loop detected, next assistant response must choose one: (a) assumption-based draft synthesis, (b) multiple-choice disambiguation, or (c) explicit proceed-with-assumptions confirmation.
   2.3 Session must reach either `mode='refine'` or draft-preview unlock within bounded additional turns after loop detection.
   2.4 Persisted draft version metadata includes loop diagnostics for auditability.

3. **Suggested-input chips above composer**
   3.1 When response includes clear choices (`questions.length > 0` or deterministic shortcuts), chips render immediately above input area.
   3.2 Clicking a chip sends/queues the exact chip text through existing turn pipeline.
   3.3 Chips are hidden when no clear choices exist.

4. **Enter/Shift+Enter behavior**
   4.1 Enter sends current message when composer is non-empty and session is not thinking/starting.
   4.2 Shift+Enter inserts newline without sending.
   4.3 Behavior works for keyboard-only interaction and does not double-submit.

5. **Telemetry and evidence**
   5.1 Product events emitted for: chip-click send, keyboard enter-send, loop-detected, loop-escape path.
   5.2 Demo evidence includes one transcript showing loop detection and successful transition to refinement.

---

## Rollout risks

1. **False-positive loop detection** may prematurely force refinement.
   - Mitigation: conservative threshold + feature flag + metadata review.

2. **False-negative loop detection** may not reduce current pain.
   - Mitigation: add dashboard/query for repeated-question sessions and tune heuristics.

3. **Team grouping regression risk** in existing overview rendering.
   - Mitigation: role-based snapshot/unit tests for manager/team-member/senior-leader.

4. **Composer UX regression** (newline/send edge cases, IME behavior).
   - Mitigation: explicit keyboard handling tests and manual checks for key combos.

5. **Increased complexity in coaching orchestration** could make responses less predictable.
   - Mitigation: bound anti-loop behavior to minimal deterministic policy and log structured reasons.

---

## Assumptions

- Existing API payload already contains `team_id` on OKRs and can be propagated to overview grouping without schema migration.
- Latest draft session (`id=6`) is representative of Robin’s reported loop experience.

## Recommended next increment (after this one)

- Add explicit per-turn coaching stage indicator (`Pass 1/2/3`) in UI with completion checklist so user sees progress and unresolved items transparently.