# Product Increment Delivery Standard (Default)

Date adopted: 2026-03-05  
Owner: Robin + Bosworth

This is the **default operating standard** whenever Robin asks to “deliver a product increment”.
Unless Robin explicitly says otherwise, the full process below is assumed.

## Definition of Done (must all be true)

1. **Requirements clarified and captured**
   - Problem statement, user outcomes, constraints, non-goals documented.
2. **Design decisions documented**
   - Product behavior, architecture choices, trade-offs, and ADR-impact notes captured.
3. **Implementation complete for increment scope**
   - Code merged locally in working branch with migration-safe changes.
4. **Working demo available**
   - Running URL provided and verified.
5. **Demo data populated (hard gate)**
   - Multi-team/sample data present so key workflows can be demonstrated without setup friction.
   - Before presenting to Robin, run demo seeding and verify non-empty records via API/DB checks.
   - If data is empty, do not present as demo-ready.
6. **Representative user-group testing complete**
   - At least one test scenario validated for each required persona group in scope.
7. **Automated checks run and reported**
   - Typecheck, build, integration tests (and e2e when in scope).
8. **Access instructions included**
   - Exact steps to run/access demo and exercise key flows.
9. **Evidence documented**
   - A concise run note in `docs/` with links, test outcomes, known limits, and next increment proposal.

## Default workflow for each increment

### Phase A — Scope + success criteria
- Restate requested increment.
- Define acceptance criteria and persona behaviors.
- Confirm out-of-scope items to prevent drift.

### Phase B — Design + task decomposition
- Produce implementation plan (API, data model, UI, authz, tests, migration).
- Break into sequenced tasks with risk notes.
- Capture rationale for key choices.

### Phase C — Build
- Implement code changes in small coherent commits.
- Add migration/seed updates when needed.
- Keep behavior backwards compatible unless explicitly changed.

### Phase D — Verify
- Run deterministic checks:
  - `npm run typecheck`
  - `npm run build`
  - `npm run test:api:integration` (or equivalent scoped suite)
- Run persona-level verification scenarios for each required user type.

### Phase E — Demo readiness
- Start runnable environment.
- Seed data for all required teams/users.
- **Mandatory pre-demo verification (no exceptions):**
  - Run seeding script(s).
  - Confirm non-empty domain records (OKRs/KRs/check-ins) via API and/or DB check.
  - Confirm leader/manager views return populated payloads.
- Validate each demo path end-to-end from the UI/API.

### Phase F — Handover
Return only when demo-ready with:
1. What changed (product + architecture)
2. Test evidence
3. Demo link
4. Access instructions
5. Known limitations/risks
6. Proposed next increment

## User-Agent Validation v2 (mandatory)

This is now required for every increment that changes user-facing behavior.

### Validation gates
1. **LLM proof gate (for AI flows)**
   - Capture and report per-turn metadata (`source=llm|fallback`, plus fallback reason).
   - For LLM-first scenarios, any fallback counts as a failed acceptance run unless explicitly allowed.
2. **Prompt-quality gate**
   - Transcript evidence must show adaptive follow-up questions tied to user input.
   - Consecutive duplicate assistant prompts fail validation.
   - Generic prompts like “need more context” fail unless followed by explicit missing fields.
3. **Wireframe/UX conformity gate**
   - Provide screenshots mapped to approved wireframe states.
   - Any material UI drift from approved design fails sign-off.
4. **Negative-path gate**
   - Include at least one non-happy-path interaction (unexpected, vague, or conflicting input).
   - Verify graceful behavior and recovery path.
5. **Role/RBAC gate**
   - Validate at least required personas in scope (e.g., manager/team member/senior leader).
   - Confirm forbidden actions return expected behavior and messaging.

### Evidence pack required in handover
Include all of the following in the increment demo note:
- Persona walkthrough transcript snippets
- Screenshot set (key states and outcomes)
- API evidence snippets (especially AI metadata and role-scoped payloads)
- PASS/PARTIAL/FAIL verdict with rationale
- Follow-up fixes if verdict is PARTIAL/FAIL

If the evidence pack is missing, the increment is not considered done.

## Required deliverables per increment

Create/update the following in `docs/`:
- `docs/demo-<increment-name>-<date>.md`
  - Summary
  - Scope
  - Decisions
  - Test results
  - Demo URL
  - Access instructions
  - Known issues
  - Next increment

Optional but recommended:
- `docs/adr/` update when architecture trade-offs change materially.

## Quality bar

- No “done” claim without a working demo path.
- No demo without representative seeded data.
- **No demo handoff until data-population checks are explicitly passed and reported.**
- No completion without persona-based validation.
- No hidden caveats: blockers/risks stated explicitly.

## Fast mode (only when explicitly requested)

Robin can override by asking for:
- “spike only”
- “design only”
- “prototype, no tests”
- “no demo needed”

Without explicit override, this full standard applies.
