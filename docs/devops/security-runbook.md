# Security Runbook (Wave 1)

Project: `okr-copilot`  
Scope: secret hygiene, Twilio credential rotation, webhook integrity, and first-response incident handling.

---

## 1) Twilio Token Rotation SOP

Use this SOP whenever credentials are exposed, suspected leaked, or on planned rotation.

### 1.1 Triggers
- Token appears in logs, chat, screenshots, terminal history, or commit history.
- Team member offboarding.
- Routine rotation window reached.
- Suspected webhook abuse or account compromise.

### 1.2 Pre-rotation prep
1. Confirm app env vars currently used (expected names):
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_WHATSAPP_FROM` (or equivalent sender setting)
2. Identify all environments where token is set:
   - local `.env*`
   - staging secret store / runtime env
   - CI/CD variables (if present)
3. Confirm rollback option:
   - Twilio supports primary/secondary auth tokens. Keep one valid until cutover test passes.
4. Open maintenance note in team channel/docs and timestamp start.

### 1.3 Rotation procedure
1. In Twilio Console, generate/activate a new Auth Token (prefer secondary-first cutover).
2. Update secrets in **staging first**:
   - replace `TWILIO_AUTH_TOKEN` only
   - do not print token to terminal/log output
3. Restart/redeploy staging service so process reloads env.
4. Run post-rotation validation checklist (Section 2) in staging.
5. If staging passes, update production env secret(s) (same key name).
6. Restart/redeploy production.
7. Run validation checklist in production.
8. In Twilio Console, revoke old token once both environments pass.
9. Record completion details:
   - who rotated
   - when
   - affected environments
   - verification evidence links

### 1.4 Rollback
- If validation fails after cutover:
  1) revert env to previous known-good token,
  2) restart service,
  3) confirm send-test + webhook receipt,
  4) investigate root cause before retrying.
- Do **not** revoke old token until replacement is verified end-to-end.

---

## 2) Post-Rotation Validation Checklist

Run this after every token rotation (staging then production).

### 2.1 Secret/application health
- [ ] Service boots with no auth/config errors.
- [ ] `/health` endpoint returns safe status only (no raw connection strings or secrets).
- [ ] No token-like values appear in logs.

### 2.2 Outbound messaging path
- [ ] Trigger `POST /api/reminders/whatsapp/send-test` with valid auth guard.
- [ ] Twilio API call returns success (2xx).
- [ ] Recipient receives test message.

### 2.3 Webhook inbound path
- [ ] Twilio callback reaches webhook endpoint.
- [ ] Signature verification passes for valid requests.
- [ ] Tampered/missing signature is rejected when strict mode enabled.
- [ ] Request behind tunnel/proxy validates against canonical public URL.

### 2.4 Abuse and reliability checks
- [ ] Rate limit behaves as expected on webhook/send-test endpoints.
- [ ] Duplicate callback does not create duplicate state transition (idempotency).
- [ ] Failed reminder path enters retry/backoff policy and records terminal failure correctly.

### 2.5 Closeout
- [ ] Old Twilio token revoked.
- [ ] Rotation logged in runbook changelog/ops notes.
- [ ] Follow-up issues created for any failed check.

---

## 3) Environment Secret Handling Rules (Local + Staging)

### 3.1 Non-negotiables
- Never commit secrets to git (tracked files, commit messages, PR comments).
- Never post tokens in chat or tickets.
- Never echo secrets in terminal if shell history/logging is enabled.

### 3.2 Local development
- Use `.env.local` (gitignored) for local-only secrets.
- Keep `.env.example` with placeholders only.
- Rotate local tokens immediately if exposed in screen share, logs, or transcripts.
- Prefer short-lived/test credentials where available.

### 3.3 Staging environment
- Store secrets in platform secret manager/runtime env (not repo files).
- Access restricted to least privilege (only required operators/services).
- Rotate staging token before production to validate safely.
- Ensure staging and production tokens are distinct.

### 3.4 CI/CD and logs
- Inject secrets at runtime; do not hardcode in build artifacts.
- Mask known secret keys in CI logs.
- Add scanner checks where possible (secret scanning pre-commit/CI).

### 3.5 Incident hygiene
- If secret exposure is suspected, treat as compromised:
  - rotate immediately,
  - review access/activity,
  - document timeline and corrective actions.

---

## 4) Webhook Public URL Canonicalization Guidance

Twilio signature verification depends on the exact public URL used to compute the signature.

### 4.1 Canonical URL source
- Define a single canonical public base URL via config/env (example: `PUBLIC_WEBHOOK_BASE_URL`).
- Build verification target URL from:
  - canonical base URL + exact request path + query string.
- Do not rely blindly on local host headers when behind proxies/tunnels.

### 4.2 Proxy/tunnel handling
- If behind reverse proxy/ngrok/cloud tunnel:
  - trust forwarded headers only from trusted proxy layer,
  - normalize scheme/host/port/path consistently,
  - preserve query string ordering/encoding as received.

### 4.3 Strict verify mode
- Enable strict mode in non-local environments:
  - missing signature => reject (401/403)
  - invalid signature => reject (401/403)
- Optional local dev bypass must be explicit and disabled by default in staging/prod.

### 4.4 Test matrix
- Valid signed request (expected pass)
- Modified body request (expected fail)
- Missing signature header (expected fail)
- Canonical URL mismatch (expected fail)

---

## 5) Minimal Incident Response

### 5.1 Incident A: Failed reminders (delivery failures/backlog growth)
1. Triage (first 10–15 min):
   - check service health, queue/backlog, Twilio status, recent deploys.
2. Contain:
   - pause high-volume sends if runaway retries observed.
3. Restore:
   - fix config/credential issue,
   - re-run failed jobs safely (idempotent replay).
4. Communicate:
   - brief status update with impact + ETA.
5. After-action:
   - document root cause, detection gap, and preventive fix.

### 5.2 Incident B: Webhook abuse/suspicious traffic
1. Detect indicators:
   - spikes in webhook hits, signature failures, unusual IP patterns.
2. Immediate controls:
   - enforce strict signature verification,
   - tighten rate limits,
   - temporarily block abusive sources at edge/WAF if available.
3. Credential response:
   - rotate Twilio token if compromise suspected.
4. Validate integrity:
   - check for unauthorized state changes/messages.
5. Recovery + hardening:
   - patch verification/canonicalization gaps,
   - improve alerting/thresholds,
   - capture IOCs and timeline.

### 5.3 Evidence to retain
- Timestamps (UTC), impacted endpoints, request IDs/message SIDs, deploy hash, operator actions, and final resolution.

---

## 6) Operational Notes
- Tie this runbook to backlog items: `SEC-001`, `SEC-004`, `SEC-005`, `REL-001`, `REL-002`.
- Review quarterly or immediately after any incident/credential rotation.
- Keep procedures short, executable, and evidence-backed.
