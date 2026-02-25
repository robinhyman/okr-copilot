# OKR Copilot Pilot Demo Runbook

This script is intentionally short and deterministic for live demos.

## 0) Terminal setup

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot
cp .env.example .env   # first run only
npm run setup:local
npm run migrate
```

Expected output highlights:
- `postgres` container healthy
- `api` migrations applied (or `No new migrations`)

## 1) Start API + web

```bash
npm run dev
```

Expected output highlights:
- API: `OKR Co-Pilot API listening on http://localhost:4000`
- Web: Vite local URL (normally `http://localhost:5173`)

## 2) Generate draft and verify source badge

From UI (`http://localhost:5173`):
1. Enter focus area + timeframe.
2. Click **Generate draft**.
3. Confirm badge under section 2:
   - `Draft source: llm` when OpenAI credentials are valid
   - `Draft source: fallback (...)` when LLM is unavailable

Expected feedback banner: `Draft generated. Review and save.`

## 3) Save OKR and submit KR check-in

In UI:
1. Edit objective/KRs as needed.
2. Click **Save OKR**.
3. In KR check-ins, submit value + commentary.

Expected feedback banners:
- `OKR created successfully.` or `OKR updated successfully.`
- `Check-in saved.`

Expected UI behavior:
- KR current value updates.
- Check-in history list appears under each KR.

## 4) Operator reminder controls (API)

Create a reminder:

```bash
curl -s -X POST http://localhost:4000/api/reminders \
  -H 'Content-Type: application/json' \
  -H 'x-auth-stub-token: dev-stub-token' \
  -d '{"recipient":"whatsapp:+447000000111","message":"Pilot demo reminder","dueAtIso":"2026-02-25T19:00:00.000Z"}'
```

List reminders and inspect `failure_reason` field when failures occur:

```bash
curl -s 'http://localhost:4000/api/reminders?limit=5'
```

Requeue a failed reminder (replace `ID`):

```bash
curl -s -X POST http://localhost:4000/api/reminders/ID/requeue \
  -H 'x-auth-stub-token: dev-stub-token'
```

Expected response highlights:
- Success: `{"ok":true,"reminder":{"status":"pending",...}}`
- Non-failed reminder: `{"ok":false,"error":"reminder_not_failed",...}`

## 5) Fast validation command set

```bash
npm run typecheck -ws
npm run test:api:integration
npm run build -ws
```

Expected result:
- All commands exit `0`.
