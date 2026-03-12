# Architecture Plan — Team-Grouped Leader View + Chat Loop Mitigation + Input Chips + Enter-to-Send

Date: 2026-03-08  
Author: Architect  
Scope: `apps/web`, `apps/api`, draft/session observability

## 1) Architecture decision summary

This increment should be delivered as a **single UX/behavior package** with **two backend hardening threads**:

1. **Senior leader team-grouped view**
   - Move team identity/ownership from UI hardcoded map to API-backed metadata.
   - Add team grouping context to objective cards (not only rollup bars).

2. **Conversation loop mitigation**
   - Keep current anti-duplicate guard, but add **stateful loop detection** and **turn-level telemetry**.
   - Reduce loop-inducing ambiguity by moving actionable chips directly above input and enabling Enter-to-send.

3. **Composer ergonomics**
   - Suggested chips shown immediately above chat input, context-gated.
   - Enter sends, Shift+Enter inserts newline, with IME-safe handling.

Design principles applied:
- Preserve existing API contracts where possible.
- Additive schema changes only.
- Feature-flagged rollout for behavior-risky parts (loop mitigation + keyboard send).

---

## 2) Current-state findings (code + persisted artifacts)

## 2.1 Leader/team grouping gaps

Observed in `apps/web/src/lib/overviewMetrics.ts` and `apps/web/src/components/OverviewSummary.tsx`:
- `ApiOkr`/`ObjectiveOverviewInput` do not carry `team_id` in metrics path.
- Objective cards are rendered as a flat list (`metrics.byObjective`) with no team grouping for senior leaders.
- `LeaderRollupSnapshot.tsx` already displays grouped team health, but ownership labels are currently hardcoded via `TEAM_DISPLAY_META`.

Observed in backend:
- `teams` table already exists (`004_multi_team_rbac.sql`) with human-readable `name`.
- `getLeaderRollup()` currently returns only `teamId` + counts/trend, no owner metadata.

Implication: leadership view has partial grouping (rollup) but not full group-by-team narrative across objective-level cards, and owner labels are not source-of-truth.

## 2.2 Chat loop behavior risks

Observed in `apps/api/src/services/ai/okr-draft-provider.ts`:
- Current anti-loop checks only **exact previous assistant message equivalence** (`ensureNonLoopingAssistantMessage`).
- Provider is mostly stateless turn-to-turn (derives from message text heuristics), so it can still cycle through semantically similar questions when context extraction fails.
- `missingChecklist` depends on regex extraction from full message text and can repeatedly report missing fields even when user response is present but unparsable.

Observed in persistence and artifacts:
- Draft persistence stores version snapshots + metadata summaries (`okr_draft_versions`, `okr_draft_audit_events`), but no full turn transcript table.
- `docs/demo-conversational-coach-increment-2026-03-05.md` explicitly notes transcript persistence is lightweight.
- Existing tests cover only “not exact same consecutive assistant string” (integration test), not semantic-loop or repeated-question pattern over multiple turns.

Root-cause hypothesis:
1. **Backend semantic memory gap**: no durable per-session structured conversation state (asked/answered slots), only inferred each turn.
2. **Guard narrowness**: exact-string anti-loop guard misses paraphrase loops.
3. **UI feedback loop amplifier**: chip actions and input affordances are separated; user may re-trigger generic “generate” paths without clear progression signal.

---

## 3) Proposed component/API/data changes

## 3.1 Web components

1. `App.tsx`
   - Add `teamId` propagation from `/api/okrs` response into UI objective models.
   - Add `onKeyDown` handler to chat input:
     - Enter (no Shift, no composing) => send
     - Shift+Enter => newline
   - Add `isComposing` guard for IME.

2. New/updated chat composer component (recommended extraction)
   - Extract from modal into `CoachComposer`:
     - `SuggestedChipsRow` directly above input
     - input field/textarea
     - send button
   - Chips include (context-gated):
     - Generate draft
     - Make KRs measurable (only if KRs exist)
     - Tighten objective
     - Reduce ambition

3. `OverviewSummary.tsx` + `overviewMetrics.ts`
   - Extend objective metric model with `teamId`, `teamName`, optional `ownerLabel`.
   - For senior leader role, render grouped sections:
     - Team heading with owner
     - Objectives within team
   - For manager/team_member, keep current flat objective list (backward-compatible UX).

4. `LeaderRollupSnapshot.tsx`
   - Replace hardcoded `TEAM_DISPLAY_META` with payload fields from API.
   - Keep fallback title-case formatter as safety net.

## 3.2 API contracts

1. `GET /api/okrs`
   - Ensure each OKR includes `team_id`, and optionally `team_name`, `team_owner_display` for leader personas.

2. `GET /api/leader/rollup`
   - Extend `teams[]` item:
     - `teamId`
     - `teamDisplayName`
     - `ownerUserId` (nullable)
     - `ownerDisplayName` (nullable)
     - status counts

3. `POST /api/okr-drafts/:id/chat`
   - Include additive loop metadata in response:
     - `loopRiskScore` (0-1)
     - `loopSignals` (string[])
     - `turnId` (server-generated)

All changes additive; existing clients remain compatible.

## 3.3 Data layer / schema

### A) Team metadata enrichment (no breaking migration)
- Add lookup query joining `teams` and manager membership/user display name for rollup payload.
- No required schema change (tables already present).

### B) Conversation observability and loop detection
Add migration `009_conversation_turn_events.sql`:
- `conversation_turn_events`
  - `id`, `draft_session_id`, `turn_index`, `user_message_hash`, `assistant_message_hash`
  - `assistant_mode`, `missing_context`, `loop_risk_score`, `loop_signals` (jsonb)
  - `provider`, `source`, `created_at`
- Indexes on `(draft_session_id, turn_index desc)` and `(draft_session_id, created_at desc)`.

This supports troubleshooting and regression analysis without storing full sensitive transcript text by default (hash + structured signals).

---

## 4) Loop mitigation design + instrumentation

## 4.1 Mitigation logic (backend)

Add a `LoopGuard` stage after LLM/fallback response normalization:

Inputs:
- last N turns (recommend N=6) from in-memory request + latest DB turn events
- proposed assistant message
- missing checklist and mode

Signals:
1. `same_missing_context_repeats` (same first missing field >=2 turns)
2. `semantic_similarity_high` (normalized n-gram/Jaccard over assistant prompts)
3. `no_draft_delta` (draft hash unchanged >=2 assistant turns in questions mode)
4. `user_rephrase_detected` (user intent changed but question class unchanged)

Actions:
- If risk medium/high:
  - force a **progress-summary pivot** message: “Here’s what I captured and what single detail is still missing.”
  - constrain to one explicit missing field with example format.
  - append `loopSignals` in metadata.

## 4.2 Instrumentation additions

Emit product events (batch with existing `/api/events/product`):
- `coach_loop_risk_detected` { draft_session_id, risk_score, signals }
- `coach_loop_guard_applied` { strategy: summary_pivot|question_rewrite }
- `coach_turn_no_draft_delta` { consecutive_count }
- `coach_chip_clicked` { chip_type, had_draft, coach_mode }
- `coach_enter_to_send_used` { input_length }

Persist turn telemetry in `conversation_turn_events` for post-hoc analysis.

---

## 5) Test plan

## 5.1 Unit tests

### API/provider
- `LoopGuard` signal computation:
  - repeated missing context detection
  - paraphrase loop detection
  - no-draft-delta counter behavior
- ensure anti-loop rewrite selects next missing field and not previous phrasing.

### Web
- composer key handling:
  - Enter submits when valid
  - Shift+Enter inserts newline
  - composing/IME Enter does not submit
- chips gating based on draft maturity and coach mode.
- team-grouped selector grouping correctness.

## 5.2 Integration tests (API)

- Multi-turn conversation where user answers baseline in varied format; assert missing baseline question is not repeated >1 cycle.
- Loop-risk event emitted and persisted when repeated question pattern occurs.
- `/api/leader/rollup` returns display/owner metadata and preserves old fields.
- `/api/okrs` includes team context for leader persona.

## 5.3 UI/e2e tests

- Senior leader overview shows objectives grouped by team heading + owner label.
- Suggested chips appear above input and trigger chat turn.
- Enter-to-send happy path; Shift+Enter newline path.
- Regression: no duplicate “Continue later”, preview unlock behavior unchanged.

---

## 6) Migration and rollback safety

## 6.1 Migration plan

1. Deploy additive DB migration `009_conversation_turn_events.sql`.
2. Deploy API with dual-read/no-dependency mode:
   - if table unavailable, continue without turn persistence.
3. Deploy web with feature flags:
   - `FF_COACH_ENTER_TO_SEND`
   - `FF_COACH_CHIPS_ABOVE_INPUT`
   - `FF_LEADER_TEAM_GROUPED_OBJECTIVES`

## 6.2 Rollback

- Web rollback: disable flags, redeploy previous static behavior.
- API rollback: disable loop guard path and telemetry writes via env flag; maintain existing response schema.
- DB rollback: leave additive table in place (no destructive rollback required).

## 6.3 Operational safeguards

- Cap telemetry writes per request (single batched event call, one DB insert per turn).
- Ensure no PII transcript persistence by default (hash/signals only).

---

## 7) Sequenced implementation tasks

## Phase 1 — Data/API foundation
1. Add rollup team metadata query + response fields.
2. Extend `/api/okrs` payload with team context for leader usage.
3. Add migration `009_conversation_turn_events.sql` + repository helper.

## Phase 2 — Loop guard backend
4. Implement `LoopGuard` module and integrate into `continueConversation` pipeline.
5. Add loop telemetry events + turn event persistence.
6. Add API/integration tests for semantic-loop scenarios.

## Phase 3 — Web UX updates
7. Implement `CoachComposer` with chips directly above input.
8. Add Enter-to-send + Shift+Enter behavior (IME-safe).
9. Implement team-grouped objective rendering for senior leader overview.
10. Remove hardcoded leader owner map dependency; consume API metadata.

## Phase 4 — Quality gates and rollout
11. Run unit/integration/e2e suites and release gate scripts.
12. Enable flags in staging, validate transcript traces + leader grouping.
13. Progressive production enablement (leader view first, then keyboard/chip, then loop guard strict mode).

---

## 8) Risks and mitigations

1. **Over-correction in loop guard** may prematurely switch to refinement.
   - Mitigation: thresholded risk score + feature flag + shadow telemetry before strict intervention.

2. **Keyboard behavior regressions** (accidental sends).
   - Mitigation: require explicit IME/composition checks; retain send button.

3. **Owner metadata incompleteness** across teams.
   - Mitigation: graceful fallback to `Owner: Unassigned` while preserving team display names from DB.

4. **Telemetry overhead**.
   - Mitigation: batched product events and compact turn event schema.

---

## 9) Done criteria (architecture)

- Boundaries explicit: web composition vs API orchestration vs data observability.
- Additive contracts only, no breaking schema/API changes.
- Loop root-cause is measurable with persisted signals.
- Rollback path is flag-based and low risk.