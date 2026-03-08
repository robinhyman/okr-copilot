# Build-Ready Increment Spec — Wizard-first vs Conversational-first A/B Experiment

Date: 2026-03-08  
Owner: Product Owner (OKR Copilot)

References (required by operating system):
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`
- `docs/demo-wizard-increment-2026-03-05.md`
- `docs/demo-conversational-coach-increment-2026-03-05.md`

---

## 1) Problem statement

OKR Copilot currently has two viable creation experiences proven in prior increments:
- **Wizard-first** structured flow (`/api/okrs/wizard-draft`, deterministic step progression)
- **Conversational-first** coach flow (modal chat, draft lifecycle, anti-loop guard, field-specific prompts)

Both can produce publishable OKRs, but we do not yet have controlled evidence for which entry experience yields better user outcomes per role (manager/team member), faster completion, higher publish quality, and lower abandonment. Product decisions are currently based on qualitative preference and demo evidence rather than experiment-grade behavioral data.

**Increment goal:** ship a production-safe, measurable A/B experiment that randomly assigns eligible users to Wizard-first or Conversational-first creation entry and captures outcome telemetry sufficient for a go/no-go decision.

---

## 2) Hypotheses

### H1 (Primary)
Conversational-first increases **draft-to-publish conversion rate** vs Wizard-first for eligible users creating a new OKR.

### H2
Wizard-first reduces **time-to-first-valid-draft** vs Conversational-first.

### H3
Conversational-first improves **draft quality proxy score** (fewer missing required fields, fewer validation corrections before publish).

### H4 (Guardrail)
Neither variant causes materially worse **error rate**, **fallback rate** (for AI path), or **RBAC denial confusion** compared with baseline tolerances.

---

## 3) Scope

### In scope
1. **Experiment assignment framework**
   - Add server-side deterministic assignment for experiment `okr_create_entry_v1` with variants:
     - `wizard_first`
     - `conversational_first`
   - Assignment persisted per eligible user for experiment duration.

2. **Entry-point routing behavior**
   - On OKR create action, route user to assigned default flow.
   - Permit explicit user switch between flows; capture switch events.

3. **Eligibility and persona coverage**
   - Include personas allowed to create drafts today (manager + team member where permitted by existing RBAC).
   - Preserve manager-only publish rule.

4. **Telemetry + event schema implementation**
   - Implement event instrumentation listed in Section 5 across web + API.
   - Include correlation keys for session, draft, persona, team, and variant.

5. **Experiment ops controls**
   - Feature flag to enable/disable experiment globally.
   - Kill switch per variant.
   - Optional forced variant override for QA environments.

6. **Reporting-ready aggregates**
   - Produce query/view/job for core KPIs: conversion, time-to-draft, time-to-publish, abandonment, fallback/error rates, publish quality proxy.

### Out of scope
- Redesign of wizard steps or conversational prompt strategy beyond minimal instrumentation hooks.
- New LLM provider work, model tuning, or prompt overhaul.
- Manual KR table editor changes.
- Changing publish authorization policy.
- Multi-armed bandit or adaptive allocation (this increment is fixed 50/50 unless manually overridden).

---

## 4) Acceptance criteria (testable)

1. **Assignment determinism**
   - Given experiment enabled, first eligible create-intent request assigns one variant and persists it.
   - Subsequent create-intent requests for same user return same variant.

2. **Balanced allocation**
   - In QA seed population, assignment distribution is within 45/55 to 55/45 over >= 200 synthetic users.

3. **Default routing by variant**
   - `wizard_first` users land in wizard flow as default create path.
   - `conversational_first` users land in conversational modal flow as default create path.

4. **Flow switch support**
   - Users can switch from default flow to alternative flow without loss of current draft context where technically available.
   - Flow-switch event recorded with source/target variant context.

5. **RBAC preservation**
   - Team member can create/refine drafts per existing permissions.
   - Team member publish remains blocked.
   - Manager publish remains allowed.
   - RBAC outcomes are logged as events.

6. **Instrumentation completeness**
   - Required events in Section 5 emitted for >= 99% of successful create journeys in integration test harness.
   - Event payloads include mandatory dimensions.

7. **AI/fallback metadata continuity**
   - Conversational flow events retain `source=llm|fallback` and fallback reason where applicable.
   - Missing metadata causes validation failure in automated checks.

8. **Experiment controls**
   - Global experiment flag off returns existing non-experiment default behavior.
   - Variant kill switch removes that variant from assignment and routes users safely.

9. **No regression in baseline quality gates**
   - Typecheck/build/tests pass.
   - Persona validation (manager/team member/senior leader visibility where relevant) passes for in-scope interactions.
   - Demo-ready seed checks remain non-empty for OKRs/KRs/check-ins/draft sessions.

10. **Evidence artifact produced**
   - Demo/evidence note created for this increment in `docs/demo-...` format including KPI snapshot and PASS/PARTIAL/FAIL verdict.

---

## 5) Event instrumentation requirements

All events must include common envelope:
- `event_name`
- `timestamp`
- `experiment_id` = `okr_create_entry_v1`
- `variant` (`wizard_first` | `conversational_first` | `none`)
- `user_id`
- `persona` (manager | team_member | senior_leader | other)
- `team_id`
- `session_id`
- `draft_session_id` (nullable until created)
- `request_id`/trace id
- `app_version`

### Required events
1. `exp_assignment_created`
   - props: assignment_method, hash_bucket, eligibility_result
2. `okr_create_entry_opened`
   - props: routed_flow, route_source (assignment|manual_override)
3. `okr_flow_switched`
   - props: from_flow, to_flow, step_or_turn_index
4. `okr_draft_started`
   - props: flow, draft_session_id
5. `okr_draft_updated`
   - props:
     - flow
     - update_type (wizard_step|chat_turn|manual_edit)
     - completeness_score (0-1)
6. `okr_draft_generated`
   - props: flow, generation_source (`llm|fallback|deterministic`), fallback_reason (nullable)
7. `okr_draft_validation_failed`
   - props: failure_codes[] (missing_baseline, missing_target, missing_timeframe, etc.)
8. `okr_publish_attempted`
   - props: flow, actor_role
9. `okr_publish_succeeded`
   - props: flow, time_from_entry_ms, validations_before_publish
10. `okr_publish_blocked_rbac`
   - props: flow, actor_role, required_role
11. `okr_journey_abandoned`
   - props: flow, last_step_or_turn, idle_timeout_ms
12. `okr_error`
   - props: flow, layer (ui|api|llm), error_code, is_recoverable

### Data quality requirements
- Event delivery success >= 99% for required events in test environment.
- No PII in free-text payload fields.
- Idempotency key on server-originated events to avoid duplicates.
- Daily validation job flags missing `experiment_id`/`variant` on create/publish journeys.

---

## 6) Success/fail decision rules

### Experiment run preconditions
- Minimum runtime: 14 days OR until minimum sample threshold reached.
- Minimum sample threshold: >= 150 completed create journeys per variant.
- No active severity-1 telemetry or publish-path defects.

### Primary success rule
Ship winner if all are true:
1. Primary metric (`draft-to-publish conversion`) improves by >= 8% relative over other variant.
2. 95% confidence interval excludes zero (or Bayesian posterior probability winner > 0.95, if Bayesian method used).
3. Guardrails not violated.

### Guardrail fail conditions (any triggers FAIL/PARTIAL)
- Error rate increases > 20% relative vs other variant.
- Conversational fallback rate > 15% of conversational generation events for 3 consecutive days.
- Median time-to-first-draft degrades > 25% relative.
- RBAC blocked attempts increase > 30% without corresponding help/recovery events.

### Decision outcomes
- **WINNER_SELECTED:** one variant meets success rule and guardrails.
- **NO_CLEAR_WINNER:** insufficient statistical separation; continue or iterate.
- **FAIL_ROLLBACK:** guardrail breach or major reliability regression; disable experiment via kill switch.

---

## 7) Dependencies and risks

### Dependencies
1. Existing wizard draft endpoint and UI flow from wizard increment.
2. Existing conversational draft lifecycle APIs and UI modal from coach increment.
3. Feature flag infrastructure and config management.
4. Analytics/event pipeline and queryable warehouse sink.
5. Seed/demo scripts supporting representative multi-team personas.
6. QA harness for persona-based validation and regression coverage.

### Risks
1. **Cross-flow contamination risk**
   - Users switching flows may dilute pure variant effects.
   - Mitigation: analyze both intention-to-treat and as-treated cohorts.

2. **Sample bias by persona/team**
   - Different roles may favor different flows.
   - Mitigation: stratify reporting by persona/team; require balanced assignment checks.

3. **Telemetry gaps**
   - Missing event joins can invalidate experiment conclusions.
   - Mitigation: enforce schema validation + daily completeness audits.

4. **Fallback inflation in conversational path**
   - Could falsely depress conversational performance.
   - Mitigation: track fallback separately as guardrail; investigate provider reliability.

5. **Operational complexity**
   - Flags, overrides, and routing can introduce regressions.
   - Mitigation: explicit integration tests for flag-off, flag-on, and kill-switch states.

---

## Recommended next increment

If winner selected: promote winning flow to default globally and keep alternative as optional secondary entry for one release behind a safety flag; then run focused improvement increment on loser’s top abandonment step/turn using captured telemetry.
