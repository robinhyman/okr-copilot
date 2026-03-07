# Overview KR Check-in Modal — UI Spec

## Goal
Enable fast per-KR check-ins directly from Overview (especially mobile) using a lightweight modal launched from each KR row.

## Interaction flow
1. User opens Overview.
2. User taps **📝 Check in** on a KR.
3. Modal opens with KR context prefilled:
   - KR title
   - parent objective
   - current value + target
4. User enters:
   - new current value (required)
   - commentary note (optional)
5. User taps **Save check-in**.
6. Modal closes and Overview refreshes (progress + digest update).

## Component behavior
- Trigger location: each KR line in Objective contributors list.
- Trigger copy: `📝 Check in`.
- Modal title: `Check in on KR`.
- Validation: numeric value required; inline error text on invalid input.
- Success: inline success state + refresh of OKRs and role-based Overview data.

## Mobile considerations
- Big touch target on KR row action button.
- Modal reuses existing coach modal shell for visual consistency.
- Primary action pinned in modal footer (`Save check-in`).

## Accessibility
- Trigger has `aria-label` with KR title.
- Modal uses `role="dialog"` and `aria-modal="true"`.
- Keep keyboard-accessible close and submit actions.

## Implementation mapping
- Trigger UI: `apps/web/src/components/OverviewSummary.tsx`
- Flow wiring + submit call: `apps/web/src/App.tsx`
- Dashboard prop threading: `apps/web/src/components/OverviewDashboard.tsx`
- API endpoint (existing): `POST /api/key-results/:id/checkins` with `{ value, note }`

## Acceptance criteria
- Every KR in Overview has a check-in trigger.
- Modal opens with correct KR context.
- Save writes check-in and refreshes visible Overview state.
- Works in manager + team member personas on mobile width.
