# OKR Copilot — Security & Reliability Backlog (Wave 1)

Status legend: `todo` | `in_progress` | `done`

## P0 — Do now (before further feature expansion)

1. **SEC-001 Rotate Twilio credentials**
   - Status: `todo`
   - Owner: Robin
   - Why: existing token exposed in runtime/session context
   - Done when:
     - token rotated in Twilio
     - `.env` updated
     - send-test + webhook flow revalidated

2. **SEC-002 Protect mutating endpoints with auth guard**
   - Status: `done`
   - Owner: Engineering
   - Scope:
     - `POST /api/reminders/*`
     - `POST /api/reminders/whatsapp/send-test`
   - Done when:
     - unauthorized requests are rejected
     - authorized single-user stub token/path works

3. **SEC-003 Harden health endpoint output**
   - Status: `done`
   - Owner: Engineering
   - Scope:
     - remove raw dependency URLs/connection strings from `/health`
   - Done when:
     - `/health` returns only safe status fields

4. **SEC-004 Webhook signature canonicalization + strict verify mode**
   - Status: `done`
   - Owner: Engineering
   - Scope:
     - canonical URL source for signature validation
     - strict reject on invalid/missing signatures when enabled
   - Done when:
     - valid signature requests pass
     - tampered/missing signatures fail
     - tested behind tunnel/proxy

5. **SEC-005 Rate limit webhook + send endpoints**
   - Status: `done`
   - Owner: Engineering
   - Scope:
     - webhook ingress
     - send-test endpoint
   - Done when:
     - abuse bursts are throttled
     - normal traffic unaffected

## P1 — Next 1–2 days

6. **REL-001 Retry/backoff policy for failed reminders**
   - Status: `todo`
   - Owner: Engineering
   - Policy baseline:
     - attempt 1 immediately
     - retries with exponential backoff
     - terminal failure after max attempts
   - Done when:
     - retry state model implemented and tested

7. **REL-002 Idempotency/dedupe for sends + webhooks**
   - Status: `todo`
   - Owner: Engineering
   - Scope:
     - dedupe key strategy for Twilio callbacks
     - protect against duplicate dispatch
   - Done when:
     - repeated callbacks do not duplicate state transitions

8. **OPS-001 Migration tooling (replace startup schema creation)**
   - Status: `todo`
   - Owner: DevOps + Engineering
   - Done when:
     - migration framework installed
     - baseline migration committed
     - startup no longer creates tables ad hoc

## P2 — Following

9. **ARCH-001 Auth provider swap path formalization**
   - Status: `todo`
   - Owner: Architect + Engineering

10. **SEC-006 Audit + retention + redaction policy**
   - Status: `todo`
   - Owner: Architect + DevOps

---

## Acceptance constraints from Robin (locked)
- Escalation style should mirror existing assistant interaction pattern (gentle first, more direct if slipping).
- Reminder tone default: friendly + professional.
- Cadence/escalation should be configurable in product UI.
- MVP functional goals:
  1) LLM-assisted OKR creation in UI
  2) view/edit OKRs in UI
  3) KR check-in with value + commentary
