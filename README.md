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

### One-command browser demo (macOS local)

From repo root:

```bash
npm run deploy:local
```

What this script does deterministically:
- creates `.env` from `.env.example` if missing
- starts Docker dependencies (`postgres`, `redis`)
- runs `npm ci`
- runs DB migrations
- starts API and web dev servers
- runs smoke checks against API + browser route
- prints `DEPLOY_OK` on success

Success markers and URLs:
- `DEPLOY_OK`
- Demo URL: `http://127.0.0.1:5173/overview`
- API health: `http://127.0.0.1:4000/health`

Logs:
- `.local-run/api.log`
- `.local-run/web.log`

Stop behavior:
- Press `Ctrl+C` in the deploy terminal to stop API/web processes.
- Postgres/Redis remain running (stop with `docker compose down`).

### Linux production parity gate

Run:

```bash
npm run validate:linux-target
```

This validates Linux target readiness and prints:
- `LINUX_TARGET_OK`

It includes:
- CI workflow check for `ubuntu-latest`
- scan for macOS-only runtime references in project scripts/docs
- Linux containerized checks (`npm ci && npm run typecheck && npm run build` in `node:22` linux/amd64)

### Manual step-by-step (optional)

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

- Web: http://localhost:5173 (app defaults to `/overview`)
- API health: http://localhost:4000/health
- API module map: http://localhost:4000/modules
- API check-in defaults: http://localhost:4000/defaults/checkins
- API auth status: http://localhost:4000/auth/status
- WhatsApp events: http://localhost:4000/api/reminders/whatsapp/events?limit=20
- Reminders: http://localhost:4000/api/reminders?limit=20
- OKRs: http://localhost:4000/api/okrs

## Web route usage (Sprint 1 UI)
- `http://localhost:5173/overview` — status snapshot and entry points
- `http://localhost:5173/okrs` — generate draft, edit objective/KRs, save
- `http://localhost:5173/checkins` — submit KR values/commentary and view recent history

Notes:
- Navigation is route-based and preserves in-memory form/check-in state while moving between pages in the same session.
- Protected API reads/writes continue using the `x-auth-stub-token` header from `VITE_AUTH_STUB_TOKEN`.

## Validation commands
```bash
npm run typecheck
npm run build
npm test
npm run e2e:checkins:local
```

## PR preview deployments (Render)

This repo now includes a PR preview deployment path so Robin can review changes in-browser without local deploy steps.

What is configured:
- `render.yaml` blueprint for a full-stack preview target (web + API in one Docker service, plus managed Postgres + Redis)
- `Dockerfile` that builds both workspace apps and serves the React build from the API process
- `.github/workflows/preview-url.yml` that runs on PR updates and posts/updates a PR comment with the expected preview URL

Expected preview URL pattern:
- `https://okr-copilot-pr-<PR_NUMBER>.onrender.com`

One-time owner setup (Robin):
1. Create a Render account/org and connect `robinhyman/okr-copilot` GitHub repo.
2. Create a Blueprint service from this repo (`render.yaml`) on branch `main`.
3. In Render settings, enable PR previews (automatic generation).
4. Set required secret env vars at service level:
   - `AUTH_STUB_TOKEN` (required)
   - `OPENAI_API_KEY` (optional; if omitted, deterministic fallback remains active)
5. Leave preview envs on non-production defaults:
   - `REMINDER_WORKER_ENABLED=false`
   - `TWILIO_VERIFY_SIGNATURE=false`
   - no production Twilio credentials in preview.

Behavior:
- Every PR open/sync triggers Render preview deploy.
- GitHub workflow updates a sticky PR comment with the expected preview link.
- API health endpoint for checks: `/health`.

Security notes:
- Preview uses isolated managed preview data stores (from Render blueprint).
- Do not copy production secrets into preview.
- If WhatsApp/Twilio testing is needed, use dedicated sandbox credentials only.

## PR release evidence checklist
Run this before opening/updating a PR:

```bash
npm run release:checklist
```

Default evidence file: `docs/qa/pr-evidence.md`.

Required fields:
- `DEPLOY_OK: PASS|OK|TRUE|YES|✅`
- `LINUX_TARGET_OK: PASS|OK|TRUE|YES|✅`
- `E2E_ARTIFACTS: <artifact path or URL>`
- `USER_SIM_VERDICT: PASS|FAIL|BLOCKED|NEEDS_FOLLOW_UP|✅|❌`

Example:
```md
DEPLOY_OK: PASS
LINUX_TARGET_OK: PASS
E2E_ARTIFACTS: artifacts/e2e/report/index.html
USER_SIM_VERDICT: PASS
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
- Web app now uses a route shell with three pages:
  - `/overview` for snapshot stats and quick actions
  - `/okrs` for draft generation + edit/save
  - `/checkins` for KR check-ins + recent history
- UI status messages are now route-scoped and auto-expire (prevents stale toasts leaking into other pages).
- Check-in submit handling is now per-KR in-flight guarded (prevents duplicate multi-click submissions while still allowing different KRs to submit in parallel).
- Existing API contracts remain unchanged for draft/save/check-in flows.
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
