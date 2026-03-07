# Architecture Notes — Weekly Execution Intelligence (2026-03-05)

## Design choices
1. **Structured check-ins implemented as extension of `kr_checkins`**
   - Added optional fields: `progress_delta`, `confidence`, `blocker_tags`, `note`
   - Preserved legacy `commentary` for backward compatibility
2. **At-risk derivation implemented as API read-model logic**
   - Manager digest computed from latest check-in per KR in team
   - Reason codes surfaced for transparency (`low_confidence`, `negative_progress_delta`, `stale_update`, etc.)
3. **Leader rollup built as aggregate projection**
   - Team-level current status split by progress ratio bands
   - 4-week trend from check-ins by confidence/progress signal
4. **KR quality guidance implemented as non-blocking endpoint**
   - Rule-based hint generation
   - No write enforcement; UI keeps save path unblocked

## Trade-offs
- Chose **rule-based heuristics** over model scoring for sprint-speed and explainability.
- Kept schema evolution additive (no destructive changes) to preserve existing flows.
- Trend is derived on demand, not materialized; acceptable at MVP scale.

## RBAC preservation
- Manager digest + KR quality hints require manager permission on active team.
- Leader rollup requires senior leader role.
- Check-in write path remains manager/team-member only.

## Data seeding strategy
- Migration seeds additional users/managers and structured check-ins across Product/Sales/Ops.
- `scripts/seed-demo.sh` now seeds all three teams with objective/KR sets.
