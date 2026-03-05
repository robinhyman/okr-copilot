# Demo Notes — Wizard Draft Creation Increment (2026-03-05)

## What changed
- Added deterministic wizard-style draft flow in web UI (6 steps with progress + next/previous/reset).
- Added backend endpoint `POST /api/okrs/wizard-draft` for full draft generation from structured wizard inputs.
- Added bounded AI-assist option with deterministic fallback.
- Preserved existing save (`/api/okrs/bulk-upsert`) and check-in flows.
- Kept RBAC unchanged (auth headers and role checks remain on save/check-in/read endpoints).

## Demo steps
1. Start stack and migrate DB.
2. Open `http://127.0.0.1:5173/okrs`.
3. Complete wizard steps 1–6.
4. Click **Generate full draft**.
5. Review/edit generated objective + KRs.
6. Click **Save objectives**.
7. Go to `/checkins`, submit check-ins to confirm downstream flow.

## Seed + non-empty data verification
Run:
- `npm run seed:demo`

Then verify:
- Product/Sales/Ops teams have objectives and KRs.
- Submit at least one check-in per team in demo run.
- Confirm check-in history is non-empty in `/checkins`.

## Evidence checklist
- Wizard progress indicator visible
- Draft generated without looping prompts
- Saved OKRs visible in `/overview` and `/okrs`
- Check-ins appear with history entries

## Persona/access instructions
Use built-in persona switcher:
- Manager personas for create/edit/save
- Team member persona for check-ins
- Senior leader persona for roll-up view

Headers are auto-set in UI via selected persona (`x-auth-user-id`, `x-auth-team-id`, `x-auth-stub-token`).

## Demo URL
- `http://127.0.0.1:5173/okrs`
