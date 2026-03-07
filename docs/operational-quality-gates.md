# Operational Quality Gates Runbook

This runbook defines deterministic demo/release rails so quality checks are executable (not memory-based).

## Commands

```bash
npm run demo:prepare
npm run release:gate
```

## What `demo:prepare` does

1. Runs DB migrations.
2. Starts API locally.
3. Seeds demo data.
4. Verifies:
   - non-empty domain data (`okrs`, `krs`, `checkins`)
   - manager digest has populated items
   - leader rollup has populated teams
   - coach metadata source exists
   - when `COACH_LLM_REQUIRED=true`:
     - `OPENAI_API_KEY` must be present
     - coach turn source must be `llm`
   - duplicate assistant anti-loop guard exists in runtime + integration tests
5. Prints PASS/FAIL summary and exits non-zero on failure.

## What `release:gate` does

1. `npm run typecheck`
2. `npm run build`
3. `npm test`
4. `npm run demo:prepare`
5. Runs acceptance checks again for explicit release verdict

## Environment flags

- `COACH_LLM_REQUIRED` (default `false`)
- `DEMO_STRICT_GATES` (default `true`)
- `OKR_DRAFT_LLM_TIMEOUT_MS` (default `30000`)

## Evidence

Use `docs/templates/increment-evidence-template.md` to capture command output and gate outcomes for each increment.
