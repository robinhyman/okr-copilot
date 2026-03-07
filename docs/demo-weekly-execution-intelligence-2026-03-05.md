# Demo Notes — Weekly Execution Intelligence (2026-03-05)

## Summary
Delivered MVP for weekly execution intelligence across API, DB, and web UI:
- Structured weekly check-ins (progress delta, confidence, blocker tags, note)
- Manager at-risk digest with reason codes
- Senior leader rollup snapshot with 4-week trend
- KR quality guidance on create/edit (non-blocking hints)

## Scope delivered
- New DB migration: `005_weekly_execution_intelligence.sql`
- API endpoints:
  - `GET /api/manager/digest`
  - `GET /api/leader/rollup`
  - `POST /api/kr-quality/hints`
  - Extended `POST /api/key-results/:id/checkins`
- Web updates:
  - Check-in form expanded with weekly structured fields
  - Overview renders manager digest or leader rollup based on persona
  - OKR editor displays KR quality hint list

## RBAC behaviors validated
- Managers: can access digest + quality hints in own team
- Team members: can submit check-ins, cannot access manager digest/quality endpoint
- Senior leaders: can access cross-team rollup, cannot submit check-ins

## Demo URL
- Web: `http://localhost:5173`
- API: `http://localhost:4000`

## Access instructions
1. Start Postgres + API + web:
   - `npm run migrate`
   - `npm run dev`
2. Optional reseed demo scenario data:
   - `npm run seed:demo`
3. In UI persona selector use:
   - Manager digest: `Manager · Product/Sales/Ops`
   - Leader rollup: `Senior leader · cross-team (...)`
   - Weekly check-ins: `Team member · Product/Sales`

## Evidence checklist
- Automated tests include new integration suite `weekly-execution-intelligence.integration.test.ts`
- Existing OKR + RBAC test suites remain green
- Typecheck and build executed for all workspaces

## Known limits / MVP constraints
- Risk derivation is heuristic, rule-based (no predictive forecasting)
- Rollup trend window fixed at last 4 weeks
- KR quality hints are rules-based and manager-scoped

## Next increment proposal
- Add reminder nudges + due-state for weekly check-ins
- Add configurable risk taxonomy and thresholds per team
- Add drill-down links from leader rollup into manager digest filtered views
