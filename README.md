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

### 1) Install
```bash
npm install
```

### 2) Configure env
```bash
cp .env.example .env
```

### 3) Start local infra (Postgres + Redis)
```bash
docker compose up -d
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

## Validation commands
```bash
npm run typecheck
npm run build
npm test
```

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

Expected: 4 passing integration tests covering:
- retry scheduling on failure (1m backoff)
- eventual sent state after retry then success
- duplicate status callback handling (idempotent)
- invalid `dueAtIso` returns HTTP 400

## Current behavior
- Web shell loads and shows MVP context + ADR alignment.
- API exposes deterministic health endpoint (`GET /health`).
- API exposes module boundary list (`GET /modules`).
- API exposes locked reminder/check-in defaults (`GET /defaults/checkins`).
- API exposes MVP auth stub status (`GET /auth/status`).
- WhatsApp inbound + status webhooks are implemented.
- Outbound WhatsApp test send endpoint is implemented.
- Message events are persisted to Postgres (`message_events`).
- Reminder scheduling pipeline is implemented (`reminders` table + worker tick).
- Placeholder adapter included for Excel KR ingestion.

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
```

## Useful local commands
```bash
# stop infra
docker compose down

# stop infra + remove volumes (fresh DB)
docker compose down -v
```

## TODO (next block)
- [TODO-B3] Add proper schema migrations tooling (current table bootstrap is startup-driven).
- [TODO-B3] Wire WhatsApp provider adapter behind interface (no provider lock-in in domain).
- [TODO-B3] Parse real Excel workbook to KR update DTOs and validation errors.
- [TODO-B3] Add workspace/day budget controls for LLM runs and `ai_runs` audit model.
- [TODO-B3] Add API tests for reminders/check-in deterministic behavior.

## Notes
- Data residency target is represented in config (`DATA_RESIDENCY=uk-eu`) and should be enforced in infra/deploy choices in upcoming blocks.
- This scaffold intentionally avoids heavy framework overbuild.
