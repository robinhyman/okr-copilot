# Agent Prompt Pack (Auditable)

Version: 2026-03-08.v1

Purpose: provide consistent, distinct, reusable role profiles for software delivery sub-agents.

## Roles

- `product-owner.md`
- `architect.md`
- `ui-ux.md`
- `backend.md`
- `qa.md`
- `release-gate.md`

## Usage contract

For every delegated role run:
1. Include the role prompt text verbatim (or by exact version reference).
2. Add task-specific instructions after the role profile.
3. Record in handover:
   - role file
   - role version
   - task prompt summary
   - pass/fail against role acceptance checklist

## Spawn template (standard)

Use this structure for delegated runs:

1. `ROLE_PROMPT`: exact contents of one role file above (include version line).
2. `TASK_PROMPT`: increment-specific objective, constraints, and deliverables.
3. `OUTPUT_CONTRACT`: required handover fields (changes, evidence, risks, next step).

### Suggested wrapper

```text
[ROLE]
<verbatim role profile from docs/agent-prompts/<role>.md>

[TASK]
<task-specific request>

[REQUIRED OUTPUT]
- Role file + version used
- What changed
- Evidence/checks run
- Risks/limitations
- Next action
```

## Prompt hygiene

- Keep prompts concise and role-specific.
- Do not include secrets.
- Update version header on any behavioral change.
