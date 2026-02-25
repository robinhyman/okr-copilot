# Security Wave P0 — QA Verification Checklist (Static Review)

Date: 2026-02-25  
Scope: `apps/api/src` against `docs/backlog-security-wave.md` (P0 items SEC-002..SEC-005)  
Method: static code review only (no runtime execution in this pass)

## Overall P0 QA Status

- **SEC-002 Auth guard on mutating endpoints:** **FAIL**
- **SEC-003 `/health` redaction:** **FAIL**
- **SEC-004 Webhook signature canonicalization + strict verify:** **PARTIAL / PENDING runtime validation**
- **SEC-005 Rate limiting webhook + send endpoints:** **FAIL**

---

## 1) Auth guard verification steps (SEC-002)

### Endpoints in scope
- `POST /api/reminders` (`apps/api/src/routes/reminders.ts`)
- `POST /api/reminders/run-due` (`apps/api/src/routes/reminders.ts`)
- `POST /api/reminders/whatsapp/send-test` (`apps/api/src/routes/whatsapp-send.ts`)

### Static checks to perform
1. Confirm explicit auth guard middleware exists (e.g., token validation / `requireAuth`) and is applied to all mutating endpoints.
2. Confirm guard returns unauthorized response for missing/invalid credentials.
3. Confirm a valid authorized path/token exists for single-user mode.
4. Confirm non-mutating endpoints remain readable as intended.

### Findings (current repo)
- `app.use(authStubMiddleware(authProvider))` only injects `req.auth`; it **does not enforce access control** (`apps/api/src/modules/auth/auth-middleware.ts`, `apps/api/src/index.ts`).
- No route-level or global authorization check found on POST mutating routes.

### Verdict
- **FAIL** — unauthorized mutation rejection is not implemented yet.

### Expected runtime checks once engineered
- `POST /api/reminders` without auth => `401/403`.
- `POST /api/reminders/whatsapp/send-test` without auth => `401/403`.
- Same endpoints with valid single-user auth token/header => `2xx`/expected functional response.

---

## 2) `/health` redaction checks (SEC-003)

### Static checks to perform
1. Ensure `/health` response excludes raw connection strings/credentials.
2. Allow only safe status fields (e.g., service state, timestamp, booleans).
3. Confirm no secrets in logs from health path.

### Findings (current repo)
- `/health` returns:
  - `dependencies.postgres: env.databaseUrl`
  - `dependencies.redis: env.redisUrl`
  (`apps/api/src/routes/health.ts`)
- These are raw URLs and can contain sensitive host/user/password details.

### Verdict
- **FAIL** — output is not redacted.

### Expected runtime checks once engineered
- `GET /health` must **not** expose DSN/host/credential strings.
- Allowed pattern: `{ dependencies: { postgres: "up/down", redis: "up/down" } }` or equivalent non-sensitive summaries.

---

## 3) Webhook signature pass/fail matrix (SEC-004)

### Static implementation checks
- Signature verification is present in `apps/api/src/routes/whatsapp-webhooks.ts`.
- Strict mode gate exists: if `TWILIO_VERIFY_SIGNATURE=true`, missing/invalid signature returns `403`.
- Timing-safe compare is used.

### Important gap/risk noted
- Canonical URL currently built from headers (`x-forwarded-proto` + `host` + `originalUrl`).
- `env.twilioPublicBaseUrl` exists but is **not used** in signature canonicalization.
- Backlog asks for canonical URL source tested behind tunnel/proxy; this appears only partially addressed.

### Matrix (expected behavior)

| Case | Preconditions | Expected | Static status |
|---|---|---|---|
| Valid signature | `TWILIO_VERIFY_SIGNATURE=true`, correct URL+params signature | 200 | **PENDING runtime** |
| Missing signature | `TWILIO_VERIFY_SIGNATURE=true` | 403 `invalid_twilio_signature` | **PASS (code path present)** |
| Tampered body | `TWILIO_VERIFY_SIGNATURE=true`, signature no longer matches | 403 | **PENDING runtime** |
| Invalid random signature | `TWILIO_VERIFY_SIGNATURE=true` | 403 | **PASS (code path present)** |
| Verify disabled | `TWILIO_VERIFY_SIGNATURE=false` | Request accepted (no signature block) | **PASS (code path present)** |
| Proxy/tunnel canonical URL mismatch | Behind proxy where external URL differs from host headers | Should still validate with canonical public base URL strategy | **FAIL/PENDING** (no explicit `twilioPublicBaseUrl` canonicalization) |

### Verdict
- **PARTIAL / PENDING** — strict verification logic is present, but canonical URL hardening for proxy/tunnel scenario is not clearly complete.

---

## 4) Rate limit checks (SEC-005)

### Endpoints in scope
- `POST /api/reminders/whatsapp/inbound`
- `POST /api/reminders/whatsapp/status`
- `POST /api/reminders/whatsapp/send-test`

### Static checks to perform
1. Verify middleware/package for rate limiting is configured.
2. Confirm endpoint-specific limits and windows are defined.
3. Confirm throttle responses (typically 429) and safe headers/logging.

### Findings (current repo)
- No rate-limiter middleware found in app bootstrap or route files.
- No endpoint-level throttling controls observed.

### Verdict
- **FAIL** — SEC-005 not implemented in current code.

### Expected runtime checks once engineered
- Burst test over threshold on each scoped endpoint should produce `429` with deterministic behavior.
- Normal traffic under threshold should remain unaffected.

---

## 5) Pass/Fail rubric (for this wave)

Use this rubric for QA signoff:

- **PASS**
  - Control implemented in code.
  - Static review shows correct placement and logic.
  - Runtime checks (happy + failure paths) validated.

- **PARTIAL**
  - Core logic exists, but one or more acceptance constraints are unverified or incomplete (e.g., proxy canonicalization not proven).
  - Requires follow-up runtime test and/or code refinement.

- **FAIL**
  - Required control missing, or current behavior violates acceptance criteria.

- **PENDING**
  - Engineering change not yet present, or runtime validation not yet executed.

### Current wave disposition (this review)
- SEC-002: **FAIL**
- SEC-003: **FAIL**
- SEC-004: **PARTIAL/PENDING**
- SEC-005: **FAIL**

---

## Appendix — Evidence pointers

- Auth stub (no enforcement):
  - `apps/api/src/modules/auth/auth-middleware.ts`
  - `apps/api/src/index.ts`
- Mutating routes currently unguarded:
  - `apps/api/src/routes/reminders.ts`
  - `apps/api/src/routes/whatsapp-send.ts`
- Health leaks raw dependency URLs:
  - `apps/api/src/routes/health.ts`
- Webhook signature logic + strict reject:
  - `apps/api/src/routes/whatsapp-webhooks.ts`
- Env includes but does not appear to drive canonical URL:
  - `apps/api/src/config/env.ts` (`twilioPublicBaseUrl`)
