# Demo Evidence — coach-quality-restore-v1 (2026-03-13)

## Objective
Restore coaching quality after prompt/token compression trade-offs by prioritizing conversation quality over minimal prompt size.

## Implemented
- Restored quality-first coaching prompt style in `apps/api/src/services/ai/okr-draft-provider.ts`.
- Relaxed over-constrained turn behavior to allow up to 1–2 focused questions when context is missing.
- Increased chat memory window from `MAX_MESSAGES=12` to `MAX_MESSAGES=20`.
- Synced source-of-truth prompt doc in `docs/okr-coach-system-prompt-v2.md`.

## Validation run
### ✅ Passed
- `npm run typecheck -w @okr-copilot/api`

### ⚠️ Blocked in this runtime
- API integration regression suite could not run due local infra unavailable:
  - Postgres connection errors (`ECONNREFUSED`) when running tests.
  - Docker daemon unavailable (`/Users/assistant/.colima/default/docker.sock` not running), so local DB could not be started from this session.

## Quality-focused next checks (required before merge)
1. Bring local infra up (or CI DB service) and run:
   - targeted coach tests in `apps/api/src/tests/okrs.integration.test.ts` (anti-loop, draft-on-request, repeated-question guards)
2. Run side-by-side transcript replay against baseline scenarios (structured + fuzzy manager cases).
3. Record deltas:
   - turns-to-first-usable-draft
   - draft-on-request compliance
   - repeated-question rate
   - subjective coaching quality rubric

## Commit
- `a19de80` feat(coach): restore quality-first prompt behavior and expand convo memory window
