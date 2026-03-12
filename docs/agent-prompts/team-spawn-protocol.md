# Team Spawn Protocol (OKR Copilot)

Purpose: one-command prep for multi-agent execution using the role prompts in this folder.

## One command

```bash
npm run team:packet -- "<task objective>"
```

This generates a timestamped packet under:

- `tmp/team-packets/<timestamp>/`

Containing:
- role-specific prompt files (`product-owner.prompt.md`, `architect.prompt.md`, etc.)
- `manifest.json`

## Runtime use in OpenClaw

After packet generation, ask Bosworth:

- `spawn okr team from packet tmp/team-packets/<timestamp>`

Bosworth should then spawn one sub-agent per role using the corresponding prompt file and return a consolidated handover.

## Why this design

- Keeps role prompts versioned in-repo (`docs/agent-prompts/*`)
- Ensures each role run is auditable and reproducible
- Makes delegation deterministic and easy to repeat for each increment
