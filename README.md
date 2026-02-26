# OKR Co-Pilot (Starter Scaffold)

Pragmatic Day 1 Block 2 scaffold for the MVP as a **modular monolith in a local-first monorepo**.

## Why this shape
- Matches ADR-001: modular monolith with explicit module boundaries.
- Matches ADR-002: deterministic-first runtime with LLM as optional orchestrated capability.
- Keeps setup light for local development on this machine and when cloned elsewhere.

## Repo structure

```txt
projects/okr-copilot
├─ apps/
│  ├─ api/                     # Express + TypeScript backend
│  │  ├─ src/
│  │  │  ├─ config/            # env + runtime config
│  │  │  ├─ modules/           # ADR module boundaries
│  │  │  │  ├─ auth/
│  │  │  │  ├─ workspace-docs/
│  │  │  │  ├─ okr-domain/
│  │  │  │  ├─ checkins-reminders/
│  │  │  │  ├─ integrations/
│  │  │  │  └─ ai-orchestrator/
│  │  │  ├─ services/
│  │  │  │  ├─ reminders/      # WhatsApp reminder placeholder
│  │  │  │  └─ adapters/       # Excel ingestion placeholder
│  │  │  ├─ routes/
│  │  │  └─ index.ts
│  │  └─ package.json
│  └─ web/                     # Vite + React + TypeScript shell
│     ├─ src/
│     └─ package.json
├─ docker-compose.yml          # Local Postgres + Redis
├─ .env.example
└─ package.json                # npm workspaces + root scripts
```

## Local run

### 1) Configure env
```bash
cp .env.example .env
```

### 2) Start local infra (Postgres + Redis)
```bash
docker compose up -d
```

### 3) Bootstrap local setup (checks + install + migrations)
```bash
npm run setup:local
```

### 4) Start web + api
```bash
npm run dev
```

- Web: http://localhost:5173
- API health: http://localhost:4000/health
- API module map: http://localhost:4000/modules
- API check-in defaults: http://localhost:4000/defaults/checkins
- API auth status: http://localhost:4000/auth/status
- WhatsApp events: http://localhost:4000/api/reminders/whatsapp/events?limit=20
- Reminders: http://localhost:4000/api/reminders?limit=20
- OKRs: http://localhost:4000/api/okrs

## Validation commands
```bash
npm run typecheck
npm run build
npm test
```

## OKR draft provider (LLM + deterministic fallback)
- `POST /api/okrs/draft` now attempts OpenAI when `OPENAI_API_KEY` is present.
- If key is missing, provider call fails, or timeout hits, API gracefully falls back to deterministic draft generation.
- Response includes metadata:
  - `metadata.source`: `llm` or `fallback`
  - `metadata.provider`: `openai` or `deterministic`
  - `metadata.reason`: fallback reason when relevant

Env vars (see `.env.example`):
- `OPENAI_API_KEY` (optional but required for live LLM path)
- `OPENAI_MODEL` (default `gpt-4o-mini`)
- `OPENAI_BASE_URL` (default `https://api.openai.com/v1`)
- `OKR_DRAFT_LLM_TIMEOUT_MS` (default `5000`)
- `OKR_DRAFT_INPUT_MAX_CHARS` (default `240`)

Quick local validation:
```bash
# fallback path (no API key)
OPENAI_API_KEY= npm run test:api:integration -- --test-name-pattern "fallback"

# full API integration suite
npm run test:api:integration
```

## WSL troubleshooting (quick)
- **node/npm/npx mismatch**: run `node -v && npm -v && npx -v`. If npm/npx versions differ or point to different installs, use one runtime source only (WSL-managed Node *or* Windows Node), then restart shell.
- **npx resolves wrong binary**: run `hash -r` and reopen terminal. In WSL, prefer installing Node with `nvm` inside WSL rather than reusing Windows global binaries.
- **script-shell errors on npm scripts**: check `npm config get script-shell`. If it points to missing Git Bash/PowerShell path, reset with `npm config delete script-shell`.
- **fresh bootstrap**: from repo root, run `npm run setup:local` after `.env` and Docker are ready.

## API integration tests (retry/idempotency/validation)

Pre-reqs: local Postgres running (via `docker compose up -d`) and `.env` present.

```bash
# from repo root
npm install
cp .env.example .env

docker compose up -d

# run only API integration tests
npm run test:api:integration
```

Expected: passing integration tests covering:
- retry scheduling on failure (1m backoff)
- eventual sent state after retry then success
- duplicate status callback handling (idempotent)
- operator requeue of failed reminders
- invalid `dueAtIso` returns HTTP 400
- OKR happy path: draft -> save -> update -> check-in -> fetch + check-in history

## Current behavior
- Web app supports OKR draft generation, draft-source badges (llm/fallback), editing/saving, KR check-ins, and recent check-in history.
- API exposes deterministic health endpoint (`GET /health`).
- API exposes module boundary list (`GET /modules`).
- API exposes locked reminder/check-in defaults (`GET /defaults/checkins`).
- API exposes MVP auth stub status (`GET /auth/status`).
- WhatsApp inbound + status webhooks are implemented.
- Outbound WhatsApp test send endpoint is implemented.
- Message events are persisted to Postgres (`message_events`).
- Reminder scheduling pipeline is implemented (`reminders` table + worker tick), including failed-reminder requeue API.
- Reminder API responses include `failure_reason` for operator visibility.
- OKR domain APIs implemented: draft generation, create/update/list OKRs, KR check-ins, KR check-in history.
- Excel KR import APIs implemented (preview + apply via `.xlsx` upload, with row-level validation and source-tagged check-ins).
- SQL migration tooling added (`npm run migrate`) for schema-managed setup.

## MVP defaults now wired
- Timezone default: `Europe/London`
- Weekly check-in: Monday `09:00`
- Reminder schedule: T-24h, due-time, +24h late nudge, +72h escalation
- Review cadence: every 4 weeks (or cycle-end)
- Quiet hours: `20:00-08:00` local
- Snooze options: `2h`, `tomorrow`, `this_week`
- Pending nudges are cancelled on submission

## Auth approach (MVP)
- Single-user auth stub is enabled by default via env.
- Stub provider is behind an `AuthProvider` interface so a real provider can be swapped in later.
- TODO markers are included in auth module files for provider integration.

## Reminder/WhatsApp test commands
```bash
# Send WhatsApp test message (Twilio)
curl -sS -X POST http://localhost:4000/api/reminders/whatsapp/send-test \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"to":"whatsapp:+447841613919","message":"hello from okr-copilot"}'

# View recent message events
curl -sS 'http://localhost:4000/api/reminders/whatsapp/events?limit=20' | jq

# Create a due reminder (should send on next worker tick)
curl -sS -X POST http://localhost:4000/api/reminders \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"recipient":"whatsapp:+447841613919","message":"Reminder test","dueAtIso":"2026-02-25T11:40:00Z"}'

# Trigger reminder worker immediately
curl -sS -X POST http://localhost:4000/api/reminders/run-due \
  -H 'x-auth-stub-token: dev-stub-token'

# Generate draft OKR
curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Client delivery","timeframe":"Q2 2026"}'

# Save draft as OKR
curl -sS -X POST http://localhost:4000/api/okrs \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"objective":"Improve client delivery outcomes","timeframe":"Q2 2026","keyResults":[{"title":"Ship weekly updates","targetValue":12,"currentValue":1,"unit":"updates"}]}'

# View KR check-in history
curl -sS 'http://localhost:4000/api/key-results/1/checkins?limit=5' \
  -H 'x-auth-stub-token: dev-stub-token'

# Requeue a failed reminder by id
curl -sS -X POST http://localhost:4000/api/reminders/1/requeue \
  -H 'x-auth-stub-token: dev-stub-token'
```

## Excel KR import (MVP)

Accepted workbook format (`.xlsx`, first sheet):

- `objective` (optional for display only in MVP)
- `key_result` (required, title match, case-insensitive + trim)
- `value` (required, numeric)
- `commentary` (optional)
- `timestamp` (optional, ISO string or Excel date cell)

Example rows:

```csv
objective,key_result,value,commentary,timestamp
Improve client delivery outcomes,Ship weekly updates,4,Imported from weekly report,2026-02-26T10:00:00Z
Improve client delivery outcomes,Close loop with sponsor by Friday,1,Done,
```

Preview import (no writes):

```bash
curl -sS -X POST http://localhost:4000/api/okrs/import/excel/preview \
  -H 'x-auth-stub-token: dev-stub-token' \
  -F 'file=@./sample-kr-import.xlsx'
```

Apply import (writes check-ins with `source=excel_import`):

```bash
# apply all valid matched rows
curl -sS -X POST http://localhost:4000/api/okrs/import/excel/apply \
  -H 'x-auth-stub-token: dev-stub-token' \
  -F 'file=@./sample-kr-import.xlsx'

# apply only selected sheet row numbers (header is row 1, first data row is 2)
curl -sS -X POST http://localhost:4000/api/okrs/import/excel/apply \
  -H 'x-auth-stub-token: dev-stub-token' \
  -F 'selectedRowNumbers=2,3' \
  -F 'file=@./sample-kr-import.xlsx'
```

Full demo script: `docs/qa/pilot-demo-runbook.md`

## Useful local commands
```bash
# stop infra
docker compose down

# stop infra + remove volumes (fresh DB)
docker compose down -v
```

## TODO (next block)
- [TODO-B3] Wire WhatsApp provider adapter behind interface (no provider lock-in in domain).
- [TODO-B3] Add workspace/day budget controls for LLM runs and `ai_runs` audit model.
- [TODO-B3] Add API tests for reminders/check-in deterministic behavior.

## Notes
- Data residency target is represented in config (`DATA_RESIDENCY=uk-eu`) and should be enforced in infra/deploy choices in upcoming blocks.
- This scaffold intentionally avoids heavy framework overbuild.
