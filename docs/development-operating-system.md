# OKR Copilot — Development Operating System

Date adopted: 2026-03-08  
Owners: Robin + Bosworth

This file defines the **default execution system** for every software increment in this repo.

## 1) Canonical standard (non-optional by default)

Primary standard:
- `docs/product-increment-delivery-standard.md`

Unless Robin explicitly overrides (spike/design-only/prototype-no-tests), this standard is mandatory.

## 2) Trigger: when this must be used

Use this operating system automatically when:
- work is requested in `okr-copilot`, and
- the task is implementation, bugfix, feature delivery, demo prep, or release readiness.

## 3) Execution loop (always in order)

1. **Scope** — restate ask + acceptance criteria + out-of-scope.
2. **Design** — implementation plan + risks/trade-offs.
3. **Build** — coherent code changes + migrations/seeds as needed.
4. **Verify** — run required checks (typecheck/build/tests in scope).
5. **Demo-readiness** — verify seeded non-empty data + runnable demo flow.
6. **Evidence** — produce increment evidence note in `docs/`.
7. **Handover** — concise summary + link/instructions + known limits + next increment.

## 4) Hard gates

No “done” claim unless all pass:
- release gate scripts pass,
- demo is runnable,
- required seeded data checks pass,
- persona validation checks pass for in-scope roles,
- evidence note exists,
- **`npm run done:proof` passes** (API live + Web live + populated data checks).

If `done:proof` fails, status must be reported as **NOT DONE**.

## 5) Required evidence artifact

For each increment create/update:
- `docs/demo-<increment-name>-<date>.md`

Must include:
- what changed,
- test evidence,
- demo URL/path,
- access steps,
- known limitations/risks,
- next increment proposal.

## 6) Agent-role accountability (operating model)

Default role split for delivery:
1. Product Owner
2. Architect
3. UI/UX
4. Backend/API
5. QA/Test
6. Release/Gate

Canonical role prompts:
- `docs/agent-prompts/product-owner.md`
- `docs/agent-prompts/architect.md`
- `docs/agent-prompts/ui-ux.md`
- `docs/agent-prompts/backend.md`
- `docs/agent-prompts/qa.md`
- `docs/agent-prompts/release-gate.md`

A role can be combined in one run, but responsibilities must still be covered.

## 7) “Remember to reference this file” rule

For every new increment request in this repo, explicitly reference:
- `docs/development-operating-system.md`
- `docs/product-increment-delivery-standard.md`

If either is not referenced in the working notes/handover, the increment is incomplete.

## 8) Coaching-flow iteration guardrails (when improving coach quality)

For any coach-flow quality iteration pack:
- run multiple realistic novice scenarios from different business contexts (not one persona only),
- keep deterministic logic boundary-first (avoid heavy mid-conversation state machines),
- if suggestion chips are used, keep them to concise user-input shortcuts (few words, no auto-send, no long prose duplicates),
- include mandatory per-iteration retrospective (`worked / didn’t / changes adopted`),
- apply process fixes from retros into docs when repeated issues are found,
- maintain local demo readiness (health endpoint up + seeded non-empty demo data).
