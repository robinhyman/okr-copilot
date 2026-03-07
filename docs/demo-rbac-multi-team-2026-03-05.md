# Demo Notes — Multi-user / Multi-team RBAC (2026-03-05)

## Local demo URL
- Web: http://localhost:5173/overview
- API: http://localhost:4000
- Auth status (shows resolved actor + permissions): http://localhost:4000/auth/status

## Personas (header-driven auth stub)
UI includes a **Demo persona** switcher in the left sidebar.

1. **Manager · Product team**
   - user: `mgr_product`
   - team: `team_product`
   - expected: can view Product OKRs, create/edit OKRs, submit KR check-ins.

2. **Team member · Sales team**
   - user: `member_sales`
   - team: `team_sales`
   - expected: can view Sales OKRs and submit KR check-ins.
   - expected forbidden: create/edit OKRs (`403 forbidden_create_okr` / `403 forbidden_edit_okr`).

3. **Senior leader · cross-team**
   - user: `leader_exec`
   - team selectable: Product or Sales in UI persona switcher
   - expected: cross-team read access (sees multiple teams’ OKRs/check-in history), read-only on writes.
   - expected forbidden: KR check-in write (`403 forbidden_checkin`), OKR create/edit forbidden.

## Seed/demo data
Provisioned for 3 teams + 3 users + memberships + baseline OKRs:
- `team_product`, `team_sales`, `team_ops`
- users: `mgr_product`, `member_sales`, `leader_exec`
- seeded objectives/KRs for each team to demonstrate cross-team visibility.

Seed command:
```bash
node scripts/seed-rbac-demo.mjs
```

## Test evidence
Validated with:
```bash
npm run test:api:integration
npm run typecheck
npm run build
```

RBAC-focused tests added in:
- `apps/api/src/tests/rbac.integration.test.ts`
  - manager can create in own team
  - team member cannot create/edit OKRs, but can submit check-ins
  - senior leader has cross-team read-only access

All passed in this environment.
