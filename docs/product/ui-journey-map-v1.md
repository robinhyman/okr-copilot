# OKR Copilot — UI Journey Map & Information Architecture (v1)

## Purpose
Move OKR Copilot from a single-page prototype to a clear, low-friction multi-page product flow that supports the full weekly operating loop:
1. Onboard & setup
2. Draft & align OKRs
3. Weekly check-in
4. Review & decision-making

This document is implementation-ready for engineering and product design planning.

---

## 1) Core user journeys

### Journey A: Onboard / Setup (first run)
**Primary user goal:** Get from empty account to a usable quarter workspace in under 10 minutes.

**Entry triggers:**
- New account sign-up
- First login to new workspace
- “Start setup” from empty state

**Happy path:**
1. User lands on `/welcome` and sees a 3-step setup overview.
2. User selects workspace basics (`company/team`, `role`, `timezone`, `quarter`).
3. User chooses setup mode:
   - Quick start (recommended defaults)
   - Guided setup (custom cadence/notifications)
4. User confirms weekly cadence (default day/time for check-ins).
5. User reaches `/home` with setup complete and CTA to draft OKRs.

**Failure/edge paths:**
- Missing required setup fields blocks continue with inline validation.
- User exits mid-setup: progress persists and resume returns to last step.

---

### Journey B: Draft / Align OKRs (planning)
**Primary user goal:** Produce a high-quality OKR set quickly, then align and save it.

**Entry triggers:**
- CTA from setup completion
- “Create OKRs” in global nav
- New quarter kickoff reminder

**Happy path:**
1. User opens `/okrs/draft` and enters planning context prompt.
2. AI generates draft objectives + KRs.
3. User edits objective titles, KR metrics, start/target values.
4. User runs alignment check (lightweight validation: coverage, metric clarity, target realism).
5. User resolves flagged issues.
6. User saves as active quarter plan and lands on `/okrs/active`.

**Failure/edge paths:**
- AI generation failure shows retry and “start manually” fallback.
- Validation errors prevent save until required fields fixed.
- Save conflict (duplicate active quarter) prompts replace vs create new version.

---

### Journey C: Weekly Check-in (execution loop)
**Primary user goal:** Update KR progress in 3–7 minutes with minimal context switching.

**Entry triggers:**
- Scheduled reminder
- “Check-in due” banner on home
- Direct visit to `/check-ins/new`

**Happy path:**
1. User opens `/check-ins/new` and sees all KRs needing update.
2. User enters new value + short commentary for each KR.
3. System computes delta vs previous check-in and highlights outliers.
4. User submits all updates in one action.
5. User sees confirmation and quick summary on `/check-ins/history`.

**Failure/edge paths:**
- Invalid value format/range shows field-level correction guidance.
- Partial network failure preserves entered data locally; user retries safely.
- Stale KR version prompts refresh/merge.

---

### Journey D: Review / Decisions (weekly leadership review)
**Primary user goal:** Convert status into decisions and next actions.

**Entry triggers:**
- After weekly check-in submission
- Weekly review calendar block
- “Review” in global nav

**Happy path:**
1. User opens `/reviews/weekly`.
2. System presents objective-level status, risks, and trend snapshots.
3. User drills into underperforming KRs.
4. User records decisions: keep course, adjust target, revise initiative, escalate blocker.
5. User assigns follow-up actions with owner + due date.
6. Review is marked complete and visible in `/reviews/history`.

**Failure/edge paths:**
- No fresh check-in data: page prompts “Run check-in first.”
- Missing action owner/due date blocks decision finalization.

---

## 2) Proposed route map and navigation model

## Navigation model
**Primary nav (persistent sidebar/top nav):**
- Home
- OKRs
- Check-ins
- Reviews
- Settings

**Secondary nav (within sections):**
- OKRs: Draft, Active, History
- Check-ins: New, History
- Reviews: Weekly, History
- Settings: Workspace, Cadence, Members (later)

**Utility nav:**
- Quarter switcher
- Workspace switcher (later)
- User menu

## Route map (v1)

| Route | Auth | Purpose | MVP |
|---|---|---|---|
| `/welcome` | Yes | First-run setup wizard entry | Yes |
| `/welcome/profile` | Yes | Role/team/timezone basics | Yes |
| `/welcome/cadence` | Yes | Weekly check-in schedule | Yes |
| `/home` | Yes | Command center (next actions, due items) | Yes |
| `/okrs/draft` | Yes | AI/manual draft and editing | Yes |
| `/okrs/active` | Yes | Current quarter OKRs read/edit | Yes |
| `/okrs/history` | Yes | Past quarter snapshots | Later |
| `/check-ins/new` | Yes | Bulk weekly check-in submission | Yes |
| `/check-ins/history` | Yes | Check-in timeline by KR/objective | Yes |
| `/reviews/weekly` | Yes | Weekly review and decision capture | Yes |
| `/reviews/history` | Yes | Past review records | Later |
| `/settings/workspace` | Yes | Workspace defaults and quarter settings | Yes |
| `/settings/cadence` | Yes | Check-in reminder preferences | Yes |
| `/settings/members` | Yes | Team members and permissions | Later |

---

## 3) Per-page purpose, primary actions, required data

| Page | Purpose | Primary actions | Required data (read/write) |
|---|---|---|---|
| `welcome/profile` | Collect minimum context for sensible defaults | Save profile basics, continue | User profile, workspace metadata, quarter default |
| `welcome/cadence` | Set weekly operating rhythm | Set day/time/channel, save | Reminder preferences, timezone |
| `home` | Show what needs attention now | Start draft, run check-in, open review | Current quarter status, due check-ins, unresolved decisions |
| `okrs/draft` | Create and refine OKR draft | Generate AI draft, edit fields, run alignment, save | Draft payload, objective/KR schema, validation rules |
| `okrs/active` | Operate current OKRs | Edit objective/KR fields, archive/revise | Active OKR set, version metadata, last-updated timestamps |
| `check-ins/new` | Fast weekly progress updates | Enter KR value/commentary, submit all | Active KRs, previous values, metric constraints |
| `check-ins/history` | View progress evolution | Filter by objective/KR/date | Check-in records, computed deltas |
| `reviews/weekly` | Convert progress into decisions | Add decision, assign action, mark review complete | Latest check-ins, risk signals, action items |
| `settings/workspace` | Manage workspace defaults | Update quarter, naming, defaults | Workspace settings |
| `settings/cadence` | Tune reminder behavior | Update schedule/channel, pause reminders | Cadence config, notification prefs |

---

## 4) MVP vs later scope split

## MVP (build now)
- Single-workspace, primary user flow
- Setup wizard (profile + cadence)
- AI-assisted OKR draft + manual edit + save
- Active OKR page
- Weekly check-in bulk form
- Weekly review page with decisions + actions
- Basic history for check-ins
- Validation + retry-safe error handling

## Later (post-MVP)
- Multi-user collaboration and approvals
- Review history archive + decision analytics
- OKR version diffing and change audit trail
- Integrations (Slack/Teams/email)
- Advanced AI coaching (rewrite, risk suggestions, next-step recommendations)
- Workspace/member management and permission tiers
- Trend charts/forecasting/confidence scoring

---

## 5) UX principles for lightweight operation

1. **One-screen clarity:** Every screen must answer “What should I do next?” within 3 seconds.
2. **Progressive disclosure:** Show only essential fields first; reveal advanced options on demand.
3. **Batch actions over micro-flows:** Prefer “submit all check-ins” vs per-KR modal workflows.
4. **Draft first, perfect later:** Encourage fast first pass; support easy edits and safe retries.
5. **Never lose user input:** Preserve in-progress text/values through transient failures.
6. **Low-click navigation:** Max 2 clicks from Home to any weekly-critical action.
7. **Consistent object model:** Objective/KR terms and fields must be identical across Draft, Active, and Review pages.
8. **Actionable status, not dashboards for dashboard’s sake:** Every status color/state should map to a user decision.
9. **Mobile-tolerant desktop-first:** Primary use likely desktop, but check-in flow must remain usable on mobile.
10. **Fast perceived performance:** Optimistic UI for save/check-in where safe; clear loading states everywhere else.

---

## 6) Acceptance criteria by journey

### A. Onboard / Setup — acceptance criteria
- User can complete setup (profile + cadence) in <= 10 minutes without external help.
- Required fields are validated inline before continue.
- Setup progress persists if user leaves and returns.
- Completion routes user to `/home` with clear “Create OKRs” CTA.
- Timezone is correctly stored and used for cadence display.

### B. Draft / Align — acceptance criteria
- User can generate an AI draft from prompt with loading + success/error states.
- Draft is editable before persistence; no auto-save without explicit user action.
- Save is blocked for required fields (objective title, KR title, KR target).
- Alignment check flags at least: missing metric, ambiguous KR phrasing, unrealistic target range (basic heuristic).
- Successful save creates/replaces active quarter OKR set and confirms timestamp.

### C. Weekly Check-in — acceptance criteria
- User can submit value + commentary for all due KRs from one screen.
- Value inputs enforce KR metric constraints (type/range).
- On successful submit, KR current values and check-in records update atomically.
- On failure, entered values/comments remain intact for retry.
- Completion confirmation includes count of KRs updated and any skipped items.

### D. Review / Decisions — acceptance criteria
- Weekly review page loads latest check-in data for active quarter.
- User can record a decision per flagged KR/objective.
- Finalizing a decision requires owner + due date for follow-up action.
- Review can be marked complete only when all required decisions are resolved or explicitly deferred.
- Completed review is retrievable with timestamp and action list.

---

## Engineering notes (implementation starter)
- Reuse existing MVP Loop 1 API contracts for draft/save/check-in; add review decision endpoints.
- Suggested IDs and versioning:
  - `okrSetId`, `objectiveId`, `krId`, `checkinId`, `reviewId`, `decisionId`
  - Include `updatedAt` + optional `version` for stale-write detection.
- Add route-level guards:
  - Redirect first-time users to setup until `setupCompleted=true`.
  - Redirect review page to check-in flow when no current-week check-ins exist.
- Instrument key events:
  - `setup_completed`, `draft_generated`, `okrs_saved`, `checkin_submitted`, `review_completed`.

This v1 map is intentionally narrow to ship quickly while leaving clean extension points for collaboration and deeper analytics in v2+.
