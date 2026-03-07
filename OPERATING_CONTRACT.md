# OKR Copilot Operating Contract

Purpose: enforce consistent execution for all development work and prevent norm drift.

## 1) Mandatory workflow (always in order)

1. Intent + plan
   - State what will be done and why.
   - Give a short step plan (2-5 bullets).
2. Implement
   - Make the smallest coherent change set.
3. Verify locally
   - Run `npm run verify` (or equivalent explicit checks) before commit.
4. Commit
   - Use a conventional, specific commit message.
5. Push
   - Push branch and confirm remote is updated.
6. PR hygiene
   - Ensure PR template is complete with evidence and risks.
7. Merge-readiness report
   - Report checks, conflicts, and blockers in a concise summary.

## 2) Communication protocol (required in status updates)

Every meaningful update should include:
- Intent
- Plan
- Action log
- Outcome (done/blocked)
- Next options

## 3) Definition of done (task level)

A task is only "done" when all apply:
- Requested scope is implemented.
- Relevant tests/checks pass.
- Docs updated when behavior/UX/API changed.
- Demo environment remains populated with sufficient sample data (unless Robin explicitly requests an empty state).
- Changes committed and pushed.
- PR status communicated (or merge completed if requested).

## 4) Pre-PR quality gates

Before opening/updating a PR:
- Working tree is clean.
- Branch is pushed.
- `npm run verify` passes.
- Evidence for UI/API impact included.
- Risks and rollback notes included in PR description.

## 5) Deviation handling

If any agreed step is missed:
- Explicitly report: "Deviation detected".
- State root cause in one line.
- Apply correction immediately and continue on-contract.

## 6) Branch/merge norms

- Branch naming: `feat/*`, `fix/*`, `chore/*`.
- Base branch for product work: `main` unless explicitly changed.
- Report merge readiness using: checks status, mergeability, review blockers.

## 7) Demo data default policy (hard requirement)

- Default app state must be demo-ready and populated.
- "No data" / empty state is only allowed when Robin explicitly asks for it.
- Before handoff, verify demo data exists and reseed if needed (e.g., `npm run seed:demo` and/or `npm run demo:prepare`).
- If data is unexpectedly empty, treat it as a blocker and fix before calling work complete.

## 8) Priority order for rules

1. Explicit latest instruction from Robin
2. This `OPERATING_CONTRACT.md`
3. Repo docs/templates/checklists
4. Default assistant behavior

If two rules conflict, follow the highest-priority rule and explicitly note the conflict.
