# OKR Copilot — Local Clone & Test QA Execution Pack

Date: 2026-02-25  
Owner: QA (clone-and-run verification)

## 1) Goal
Verify Robin can clone this repo on a fresh machine, start dependencies, and run baseline quality gates successfully.

---

## 2) Prerequisites

## Linux (Ubuntu/Debian class)
- Git 2.30+
- Node.js 22 LTS (recommended: v22.22.x)
- npm 10+
- Docker Engine + Docker Compose plugin (`docker compose`)
- Ports available: `4000`, `5173`, `5432`, `6379`

Install check:
```bash
git --version
node -v
npm -v
docker --version
docker compose version
```

## Windows (11/10)
- Git for Windows
- Node.js 22 LTS
- npm 10+
- Docker Desktop (WSL2 backend recommended)
- PowerShell 7+ recommended
- Same ports available: `4000`, `5173`, `5432`, `6379`

Install check (PowerShell):
```powershell
git --version
node -v
npm -v
docker --version
docker compose version
```

---

## 3) Clone setup

## Linux/macOS shell
```bash
git clone <REPO_URL> okr-copilot
cd okr-copilot
npm ci
```

## Windows PowerShell
```powershell
git clone <REPO_URL> okr-copilot
Set-Location okr-copilot
npm ci
```

Pass criteria:
- `npm ci` exits with code `0`
- No lockfile mismatch errors

---

## 4) Env setup

```bash
cp .env.example .env
```

Windows PowerShell equivalent:
```powershell
Copy-Item .env.example .env
```

Minimum required local defaults already exist in `.env.example` (Postgres/Redis/auth stub).  
Twilio credentials are optional for baseline clone-and-run; required only for real WhatsApp send/webhook tests.

Recommended QA override for local-only smoke runs:
- `TWILIO_VERIFY_SIGNATURE=false` (if manually calling webhook endpoints)

Pass criteria:
- `.env` file present
- `AUTH_STUB_TOKEN=dev-stub-token` set (default)

---

## 5) Docker startup (Postgres + Redis)

```bash
docker compose up -d
docker compose ps
```

Pass criteria:
- `okr-copilot-postgres` is `Up (healthy)`
- `okr-copilot-redis` is `Up (healthy)`

Notes:
- Current compose warns that `version:` is obsolete; non-blocking warning.

---

## 6) Test and quality commands

Run from repo root:

```bash
npm run typecheck
npm run build
npm test
```

Expected outputs:
- `typecheck`: both workspaces complete without TypeScript errors
- `build`: API compiles; Web Vite build succeeds and emits `dist/`
- `test`: currently passes with Node test runner reporting `1..0` (no test files yet)

Current observed baseline (QA run on 2026-02-25):
- ✅ `npm ci` passed
- ✅ `docker compose up -d` passed; Postgres/Redis healthy
- ✅ `npm run typecheck` passed
- ✅ `npm run build` passed
- ✅ `npm test` passed (0 tests in API and Web)

---

## 7) Runtime smoke checks (API)

Start API:
```bash
npm run dev -w @okr-copilot/api
```

In another shell:
```bash
curl -sS http://localhost:4000/health
curl -sS http://localhost:4000/modules
curl -sS http://localhost:4000/auth/status
```

Expected:
- `/health` returns `{"status":"ok",...}`
- `/modules` returns module list
- `/auth/status` returns authenticated stub user

Mutating endpoint auth check:
```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -X POST http://localhost:4000/api/reminders/whatsapp/send-test \
  -H 'Content-Type: application/json' \
  -d '{"to":"whatsapp:+10000000000","message":"qa"}'
```
Expected: `401` when auth header is missing.

---

## 8) Pass/fail criteria for “clone-and-run”

Pass if all are true:
1. Repo clones and `npm ci` succeeds
2. Docker dependencies start healthy
3. `npm run typecheck` succeeds
4. `npm run build` succeeds
5. `npm test` exits `0`
6. API `/health` responds with `status=ok`

Fail if any command above fails or requires undocumented manual patching.

---

## 9) Coherence check vs engineering changes

## What is coherent
- Root workspace scripts correctly delegate to both apps
- Auth guard now enforced on mutating routes (`requireMutatingAuth`)
- Basic rate limiting present on webhook + send-test routes
- Health endpoint now redacts DSNs to configured booleans

## Gaps / doc drift found
1. `docs/implementation-progress-2026-02-25.md` sample curl commands for mutating endpoints omit auth header and are now stale.
   - Fix: add `-H 'x-auth-stub-token: dev-stub-token'` to POST examples.
2. Automated tests are still not implemented.
   - Current `npm test` passes with `0` tests, so confidence is low for regressions.

---

## 10) Pending checklist (post-merge / when engineering test coverage lands)

Use this exact checklist once API/web tests are added:

1. Run test suites with explicit expectations:
```bash
npm test
```
Expected:
- API test count > 0
- Web test count > 0 (or explicit justified N/A)
- 0 failures

2. Validate auth enforcement:
```bash
# without token => 401/403
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/reminders/run-due

# with token => 200
curl -sS -o /dev/null -w "%{http_code}\n" -X POST http://localhost:4000/api/reminders/run-due -H 'x-auth-stub-token: dev-stub-token'
```

3. Validate rate limiting:
```bash
for i in {1..12}; do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:4000/api/reminders/whatsapp/send-test \
    -H 'Content-Type: application/json' \
    -H 'x-auth-stub-token: dev-stub-token' \
    -d '{"to":"whatsapp:+10000000000","message":"rl-test"}'
done
```
Expected:
- First requests: not rate-limited (likely non-429)
- After threshold: at least one `429` with `Retry-After`

4. Validate webhook signature behavior (with controlled fixtures/tooling):
- Invalid/missing signature + verify enabled => `403`
- Valid signature => `200`

---

## 11) Troubleshooting quick guide

- `EADDRINUSE` on ports 4000/5173/5432/6379:
  - Stop conflicting processes or remap ports.
- Docker container not healthy:
  - `docker compose logs postgres redis`
  - Recreate: `docker compose down -v && docker compose up -d`
- `npm ci` fails due Node version:
  - Switch to Node 22 LTS and retry.
- API fails on startup:
  - Check `.env` exists and contains `DATABASE_URL`, `REDIS_URL`, `AUTH_STUB_TOKEN`.
- WhatsApp send-test returns `502 send_failed`:
  - Expected without valid Twilio credentials; not a clone-and-run blocker.

---

## 12) QA conclusion snapshot
- Clone-and-run baseline: **functionally runnable**
- Confidence level: **moderate** for setup/build; **low** for behavioral correctness until real automated tests are added
