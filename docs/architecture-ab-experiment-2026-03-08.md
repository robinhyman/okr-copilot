# Architecture Plan: A/B Default-Mode Experiment (Wizard-First vs Conversational-First)

Date: 2026-03-08  
Author: Architect agent

## 1) Decision summary

Run a controlled, sticky A/B experiment that changes only the **default entry mode** for OKR creation:
- **Variant A (control):** Wizard-first default
- **Variant B (treatment):** Conversational-first default

Both flows remain available behind an explicit mode switch in UI, so the experiment tests defaulting/framing effects rather than hard capability gating.

Key architectural choices:
1. **Server-authoritative assignment** (deterministic hash with optional override) to avoid client drift.
2. **Persistent stickiness per user+team+experiment_key** in DB for cross-device consistency.
3. **Backward-compatible API contracts**: additive responses/fields only.
4. **Telemetry-first rollout**: exposure + funnel events before ramp.
5. **Fast rollback lever**: global kill switch to force wizard-first while preserving assignment data for later re-enable.

---

## 2) Scope and boundaries

### In scope
- Default mode selection logic for `/okrs` create journey.
- Experiment assignment, stickiness, and exposure tracking.
- Additive API response fields and one assignment endpoint.
- Data model changes for assignment + event schema changes.

### Out of scope
- Redesign of wizard or conversational internals.
- Changes to publish permissions/RBAC semantics.
- Multi-armed optimization beyond 2 variants.

---

## 3) Feature flag strategy

Use a **3-layer flag model**:

### Layer 1: Global kill switch (highest priority)
- Env/config: `EXPERIMENT_DEFAULT_MODE_ENABLED` (bool, default false in prod rollout).
- If false: system behaves as current baseline (wizard-first), no assignment write required.

### Layer 2: Experiment config
- Config key: `EXPERIMENT_DEFAULT_MODE_2026Q1` (or versioned key `default_mode_v1`).
- Config fields:
  - `enabled: boolean`
  - `trafficPercent: number (0..100)`
  - `weights: { wizard_first: number, conversational_first: number }` (sum 100)
  - `eligibility: { roles?: string[], teams?: string[] }`
  - `allowOverrideHeader: boolean` (non-prod/testing only)

### Layer 3: Per-request override (lowest priority, optional)
- Header/query for QA: `x-exp-default-mode-variant` (`wizard_first|conversational_first`)
- Applied only if `allowOverrideHeader=true` and actor is internal/test.

Precedence:
1. Kill switch off -> wizard-first forced
2. Valid override -> chosen variant (no permanent reassignment unless explicitly requested)
3. Existing sticky assignment -> use it
4. New assignment by deterministic allocator

---

## 4) Assignment and stickiness logic

## Unit of assignment
- **Primary key:** `(experiment_key, user_id, team_id)`
- Rationale: user behavior may differ by team context; keeps analysis cleaner with existing team-scoped RBAC.

## Allocation algorithm
- Compute stable bucket from hash(`experiment_key:user_id:team_id`).
- If bucket >= `trafficPercent`, assign `not_enrolled` (falls back to wizard-first).
- Else map bucket into weighted variant split.

## Stickiness rules
- First eligible request creates assignment row with `assigned_at`.
- Subsequent requests always reuse row until experiment is archived.
- Variant never changes when weights/traffic change (new configs only affect *new* assignees).
- Exposure event emitted on first render/load of `/okrs` with resolved variant.

## Reassignment policy
- No in-place reassignment for active experiment.
- If re-run needed, create new `experiment_key` (e.g., `default_mode_v2`).

---

## 5) Data model and event schema changes

## 5.1 New table: experiment assignments

```sql
CREATE TABLE IF NOT EXISTS experiment_assignments (
  id BIGSERIAL PRIMARY KEY,
  experiment_key TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('wizard_first','conversational_first','not_enrolled')),
  assignment_source TEXT NOT NULL DEFAULT 'hash_v1',
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_exposed_at TIMESTAMPTZ,
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (experiment_key, user_id, team_id)
);

CREATE INDEX IF NOT EXISTS idx_exp_assignments_lookup
  ON experiment_assignments (experiment_key, team_id, user_id);
```

## 5.2 Optional event table (preferred for analysis durability)

Add a generic product event stream (if not already present):

```sql
CREATE TABLE IF NOT EXISTS product_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  user_id TEXT,
  team_id TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_json JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_time
  ON product_events (event_name, occurred_at DESC);
```

## 5.3 Event schema (minimum)

1. `exp_default_mode_exposed`
   - `experimentKey`, `variant`, `userId`, `teamId`, `surface: "okrs_create"`
2. `exp_default_mode_create_clicked`
   - same keys + `defaultModeAtClick`
3. `exp_default_mode_flow_started`
   - `flow: "wizard"|"conversational"`, `isDefaultFlow: boolean`
4. `exp_default_mode_draft_saved`
5. `exp_default_mode_published`
6. `exp_default_mode_abandoned`
   - via timeout/window-close heuristic where feasible

All events should carry `experimentKey` + `variant` for join-free analysis.

---

## 6) API and UI contract changes

## 6.1 API contracts

### A) New endpoint (recommended)
`GET /api/experiments/default-mode`

Response:
```json
{
  "ok": true,
  "experimentKey": "default_mode_v1",
  "enabled": true,
  "variant": "wizard_first",
  "defaultMode": "wizard",
  "sticky": true,
  "reason": "assigned|forced_off|override|not_enrolled"
}
```

### B) Additive extension on existing drafts session create (optional convenience)
`POST /api/okr-drafts/sessions` response can include:
- `entryModeUsed: "wizard"|"conversational"`
- `experiment: { experimentKey, variant }`

No existing fields removed/renamed.

### C) Event ingest endpoint (if needed)
`POST /api/events/product` (batched allowed)
- Accept array of events to reduce write amplification.
- Server enriches with actor context when absent.

## 6.2 UI contracts

In `apps/web/src/App.tsx`:
1. On `/okrs` load, call experiment endpoint and cache resolved `defaultMode` in state.
2. Update primary CTA behavior:
   - `wizard` default -> open wizard flow first
   - `conversational` default -> current coach modal first
3. Always display secondary “Switch to …” action so both paths remain reachable.
4. Fire exposure event once per page session after variant resolution.
5. Fire flow-start + downstream conversion events from existing save/publish actions.

---

## 7) Rollback and migration safety

## 7.1 Migration safety
- Additive migrations only (new tables/indexes), no destructive alters.
- Deploy migration before app code using new tables.
- App code must tolerate table unavailable errors in early canary by fallback to wizard-first.

## 7.2 Runtime rollback
- Immediate rollback path: set `EXPERIMENT_DEFAULT_MODE_ENABLED=false`.
- Behavior after rollback:
  - forced wizard-first default
  - existing assignment rows retained (no data loss)
  - event ingestion can continue for postmortem

## 7.3 Forward compatibility
- Version experiment key (`default_mode_v1`), never mutate meaning of existing key.
- Keep `variant` enum extensible by check-constraint migration if future arms added.

---

## 8) Test plan

## 8.1 Unit tests
1. Assignment allocator
   - deterministic output for same `(experimentKey,user,team)`
   - weight boundary correctness
   - traffic gating correctness
2. Stickiness service
   - existing row always reused
   - no reassignment on config changes
3. Fallback logic
   - kill switch off => wizard-first regardless of assignment

## 8.2 API integration tests
1. `GET /api/experiments/default-mode`
   - returns expected shape and variant
   - respects override only when allowed
2. Session/create flow
   - default mode influences first-opened flow
3. Event pipeline
   - exposure emitted once per load
   - save/publish events include experiment metadata

## 8.3 UI/e2e tests
1. Wizard-first assignee sees wizard as initial create experience.
2. Conversational-first assignee sees coach modal as initial create experience.
3. Manual switch path works both directions.
4. Publish flow still obeys manager-only permission.

## 8.4 Data quality tests
- Daily query check: exposure counts by variant roughly match configured weights (within tolerance).
- Guardrail check: publish error rates and latency not significantly worse in treatment.

---

## 9) Risks and mitigations

1. **Sample ratio mismatch (SRM)** due to assignment bug or eligibility drift  
   - Mitigation: deterministic hash + nightly SRM alert + immutable assignment rows.

2. **Cross-device inconsistency** if client-side assignment used  
   - Mitigation: server-authoritative assignment persisted in DB.

3. **Event loss / partial telemetry** leads to invalid conclusions  
   - Mitigation: server-side key events where possible (session create, publish), batched retries for client events.

4. **Behavioral contamination** (users switch away from default immediately)  
   - Mitigation: track `isDefaultFlow` on flow start; analyze ITT and as-treated.

5. **Operational risk during rollout**  
   - Mitigation: staged ramp (1% -> 10% -> 50%), kill switch, on-call dashboard for errors/latency.

6. **RBAC leakage from new endpoint**  
   - Mitigation: same auth middleware and actor context checks as existing `/api/okrs` routes.

---

## 10) Rollout sequence

1. Deploy DB migration(s) (assignments + optional events).
2. Deploy API with endpoint behind kill switch (off).
3. Deploy UI with compatibility fallback (if endpoint missing/fails -> wizard-first).
4. Enable at 1% internal teams; validate telemetry and SRM.
5. Ramp progressively with predefined stop criteria.

Stop criteria examples:
- publish conversion drops >10% relative for 24h
- p95 create-flow latency regression >20%
- elevated 5xx on `/api/okr-drafts/*`

---

## 11) Open decisions for product/data

1. Primary success metric: publish conversion vs draft-save conversion?
2. Minimum detectable effect + required run duration/sample size.
3. Whether analysis is per-user-team or user-global (current plan is user-team).
4. Whether to log additional qualitative signals (e.g., “switch reason”).

---

## Done check (architect)
- Boundaries explicit: ✅
- Migration strategy safe/additive: ✅
- Rollback path defined: ✅
- Contracts/API/UI changes concrete: ✅
- Risks actionable with mitigations: ✅
