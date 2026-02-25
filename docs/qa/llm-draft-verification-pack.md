# OKR Copilot — LLM Draft Wiring Verification Pack

Date: 2026-02-25  
Owner: QA (LLM wiring immediate verification)

## 1) Scope
Validate `/api/okrs/draft` behavior across:
- **LLM path** (API key present, provider call succeeds)
- **Fallback path** (no key or provider unavailable)
- **Failure modes** (timeout/provider error)
- **Response source markers** (metadata proving where draft came from)

---

## 2) Current repo status (as of this pack)
Current implementation appears **not fully merged for real LLM provider wiring**.

Evidence:
- `apps/api/src/services/ai/okr-draft-provider.ts` currently returns `DeterministicDraftProvider` in both branches.
- `/api/okrs/draft` response currently returns `{ ok, draft }` only, with no source metadata field.

Quick check commands:

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot

# Inspect provider wiring
sed -n '1,220p' apps/api/src/services/ai/okr-draft-provider.ts

# Inspect draft route payload shape
sed -n '1,180p' apps/api/src/routes/okrs.ts
```

---

## 3) Test matrix (target behavior)

| ID | Scenario | Setup | Request | Expected status | Expected markers | Notes |
|---|---|---|---|---|---|---|
| LLM-01 | LLM path success | Valid provider key configured | `POST /api/okrs/draft` | 200 | `source.mode=llm`, `source.provider=<provider>`, `source.fallback=false` | Draft should be provider-generated |
| LLM-02 | No-key fallback | No provider key configured | `POST /api/okrs/draft` | 200 | `source.mode=fallback`, `source.provider=deterministic`, `source.fallback=true` | Deterministic draft content |
| LLM-03 | Invalid key/provider auth error | Fake/invalid key | `POST /api/okrs/draft` | 200 (fallback) or 5xx (strict fail mode) | If fallback: `source.fallback=true`, plus `source.error.code=provider_auth` | Depends on design decision |
| LLM-04 | Provider timeout | Very short timeout / forced timeout | `POST /api/okrs/draft` | 200 (fallback) or 504/5xx | If fallback: `source.error.code=provider_timeout` | Must be deterministic + observable |
| LLM-05 | Metadata contract | Any success path | `POST /api/okrs/draft` | 200 | `source` object present and stable | Required for QA assertions |

---

## 4) Execution commands

### 4.1 Baseline setup

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot
cp -n .env.example .env
npm install
docker compose up -d
npm run migrate
```

### 4.2 Run API

```bash
npm run dev -w @okr-copilot/api
```

In another shell, use the calls below.

---

## 5) No-key mode verification (fallback expected)

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot

# Ensure no key is set for this invocation
OPENAI_API_KEY= \
curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Client delivery","timeframe":"Q2 2026"}' | jq
```

Current expected (today):
- `200`
- `ok: true`
- `draft` object present
- **No `source` metadata yet** (gap)

Target expected (post-merge):
- `source.mode = "fallback"`
- `source.provider = "deterministic"`
- `source.fallback = true`

---

## 6) Key-enabled mode verification (LLM path expected post-merge)

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot

# Replace with a real key in env for actual provider execution
export OPENAI_API_KEY="<REAL_KEY>"

curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Operationalising AI","timeframe":"Q3 2026"}' | jq
```

Current expected (today):
- Still deterministic output (same provider path effectively)

Target expected (post-merge):
- `source.mode = "llm"`
- `source.provider` identifies model/provider used
- `source.fallback = false`

---

## 7) Failure mode checks

### 7.1 Provider auth error (invalid key)

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot
export OPENAI_API_KEY="sk-invalid"

curl -sS -i -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Client acquisition","timeframe":"Q2 2026"}'
```

Target expected (post-merge):
- Either:
  - graceful fallback with `200` + `source.fallback=true` + `source.error.code=provider_auth`
- Or:
  - explicit failure (`5xx`) with machine-readable error code

### 7.2 Provider timeout

```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot

# If timeout env exists after merge, set it aggressively low:
# export LLM_TIMEOUT_MS=1

curl -sS -i -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Productivity","timeframe":"Q2 2026"}'
```

Target expected (post-merge):
- fallback mode or timeout failure mode is explicit
- response must expose marker for timeout (`provider_timeout` or equivalent)

---

## 8) Expected response markers (contract)

Recommended minimum response shape for deterministic QA assertions:

```json
{
  "ok": true,
  "draft": {
    "objective": "...",
    "timeframe": "...",
    "keyResults": [ ... ]
  },
  "source": {
    "mode": "llm|fallback",
    "provider": "openai|deterministic|...",
    "model": "gpt-...",
    "fallback": true,
    "reason": "no_api_key|provider_timeout|provider_auth|...",
    "latencyMs": 1234
  }
}
```

If engineering chooses a different field name than `source`, update this pack and the test assertions together.

---

## 9) Pending checklist (engineering changes not yet merged)

Run this exact checklist once LLM wiring PR lands:

1. **Confirm merged wiring and markers**
```bash
cd /home/openclaw/.openclaw/workspace/projects/okr-copilot
git log --oneline -n 15
sed -n '1,220p' apps/api/src/services/ai/okr-draft-provider.ts
sed -n '1,200p' apps/api/src/routes/okrs.ts
```

2. **No-key fallback path**
```bash
OPENAI_API_KEY= curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Client delivery","timeframe":"Q2 2026"}' | jq
```
Assert: `source.mode=fallback`, `source.fallback=true`, deterministic provider marker.

3. **Key-enabled LLM path**
```bash
export OPENAI_API_KEY="<REAL_KEY>"
curl -sS -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Operationalising AI","timeframe":"Q3 2026"}' | jq
```
Assert: `source.mode=llm`, `source.fallback=false`, provider/model populated.

4. **Provider auth failure behavior**
```bash
export OPENAI_API_KEY="sk-invalid"
curl -sS -i -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Sales pipeline","timeframe":"Q2 2026"}'
```
Assert: fallback marker or explicit 5xx contract (as designed).

5. **Provider timeout behavior**
```bash
# Set timeout env variable if introduced by PR, then restart API
# export LLM_TIMEOUT_MS=1
curl -sS -i -X POST http://localhost:4000/api/okrs/draft \
  -H 'Content-Type: application/json' \
  -d '{"focusArea":"Operational excellence","timeframe":"Q2 2026"}'
```
Assert: explicit timeout marker (`provider_timeout`) or explicit timeout status.

6. **Regression gate**
```bash
npm run test:api:integration
```
Add/confirm automated assertions for source metadata and fallback decisions.

---

## 10) QA note
At time of writing, this pack is **verification-ready** but currently functions as a **pending validation checklist** until real LLM provider path + source metadata are merged.