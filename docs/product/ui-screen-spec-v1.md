# OKR Copilot UI Screen Spec v1

## Purpose
Refactor the current single-page prototype into a clear, task-first product flow: generate draft → edit/save OKRs → run weekly check-ins.

This spec is wireframe-level (content hierarchy + components), not visual styling.

---

## Suggested global navigation

### Primary nav labels (left sidebar on desktop, bottom nav on mobile)
1. **Overview**
2. **OKRs**
3. **Check-ins**
4. **History**
5. **Settings**

### Why this order
- Mirrors the user journey from orientation to action.
- Keeps frequent actions (OKRs, Check-ins) in top 3.
- Moves lower-frequency admin/configuration to Settings.

### Global layout shell
- Top bar: workspace name, quarter selector, user menu.
- Primary nav: labels above.
- Main content region: page-specific content.
- Global feedback: toast/alert stack for success/error.

---

## Screen 1: Overview

### Goal
Give a fast status snapshot and direct entry points to unfinished work.

### Content hierarchy (top to bottom)
1. **Page header**
   - Title: “Overview”
   - Quarter picker (default current quarter)
2. **Status summary cards**
   - Active objectives count
   - On-track vs at-risk KRs
   - Last check-in date
3. **Action strip**
   - Primary: “Generate new draft”
   - Secondary: “Log check-in”
4. **Current objective preview**
   - Objective title
   - KR progress mini-bars (current/target + unit)
5. **Recent activity list**
   - Last 5 events (draft generated, save, check-in)

### Component list
- PageHeader
- QuarterSelect
- StatCard (x3)
- PrimaryButton / SecondaryButton
- ObjectiveProgressCard
- KRProgressRow
- ActivityFeed

### States
- **Empty:** no OKRs yet → show onboarding card with “Generate draft” CTA.
- **Loading:** skeletons for stat cards + activity rows.
- **Error:** inline alert with retry (“Couldn’t load overview. Retry”).

### Mobile considerations
- Stack summary cards vertically.
- Keep action strip as two full-width buttons.
- Collapse activity feed to latest 3 items with “View all”.

---

## Screen 2: OKRs (Draft + Edit + Save)

### Goal
Provide one focused workspace for generating AI draft, editing content, validating, and saving.

### Content hierarchy (top to bottom)
1. **Page header**
   - Title: “OKRs”
   - Meta: selected quarter + last saved timestamp
2. **Draft generator panel**
   - Inputs: focus area, timeframe/quarter
   - Action: “Generate draft”
   - Draft source badge (LLM/Fallback)
3. **Editor section**
   - Objective fields (title + timeframe)
   - Key results list (title, current, target, unit)
   - Per-KR quick actions: duplicate, delete
   - Add KR action
4. **Validation + save bar (sticky on desktop)**
   - Validation summary (if invalid)
   - Primary action: Save OKR
   - Secondary action: Discard draft changes

### Component list
- PageHeader
- MetadataRow (quarter, lastSaved)
- DraftPanel
- TextInput / NumberInput
- Badge (draft source)
- ObjectiveEditor
- KRTable or KRCardList
- AddKRButton
- InlineValidationMessage
- StickySaveBar

### States
- **Empty:** no existing OKR + no draft → prompt to generate first draft.
- **Loading:** editor skeleton while fetching existing OKR.
- **Error:**
  - Draft generation error banner with Retry.
  - Save error banner with preserved edits.
  - Field-level validation errors (required objective/KR title/target).

### Mobile considerations
- Replace KR table with stacked KR cards.
- Keep Save action as sticky bottom button.
- Collapse non-essential metadata under “Details” accordion.

---

## Screen 3: Check-ins

### Goal
Make weekly KR updates fast and low-friction.

### Content hierarchy (top to bottom)
1. **Page header**
   - Title: “Check-ins”
   - Filter: objective selector
2. **Pending check-ins list**
   - KR title + current/target summary
   - Inputs: new value, commentary
   - Action: Submit check-in
3. **Recent check-in history (per KR)**
   - Latest entries with timestamp and note
4. **Batch completion section (optional for v1.1)**
   - “Mark all done for this week”

### Component list
- PageHeader
- ObjectiveFilterDropdown
- KRCheckinCard
- NumberInput
- TextInput/TextArea
- SubmitButton
- CheckinHistoryList
- TimestampLabel

### States
- **Empty:** no KRs available → CTA to create/save OKRs first.
- **Loading:** card-level skeletons.
- **Error:** failed submit message inline on KR card; retain typed values.
- **Success:** optimistic row update + toast (“Check-in saved”).

### Mobile considerations
- One KR per card; avoid multi-column layouts.
- Commentary input defaults to 2 lines, expandable.
- Keep submit button full width for thumb reach.

---

## Screen 4: History

### Goal
Give a lightweight audit of changes and check-ins without heavy analytics.

### Content hierarchy (top to bottom)
1. **Page header**
   - Title: “History”
   - Date range filter
2. **Timeline list**
   - Event type (draft/save/check-in)
   - Who/when
   - What changed (compact diff text)
3. **Detail drawer/panel**
   - Full payload snapshot for selected item (read-only)

### Component list
- PageHeader
- DateRangeFilter
- EventTypeChips
- TimelineList
- TimelineItem
- DetailPanel

### States
- **Empty:** “No activity in selected period.”
- **Loading:** timeline skeleton rows.
- **Error:** top-level retryable error state.

### Mobile considerations
- Replace side detail panel with full-screen sheet.
- Keep default range to last 14 days to reduce list length.

---

## Screen 5: Settings

### Goal
Keep minimal configuration in one place; avoid cluttering core workflows.

### Content hierarchy (top to bottom)
1. **Page header**
   - Title: “Settings”
2. **Workspace defaults**
   - Default quarter/timeframe format
   - Preferred KR unit presets
3. **AI generation options**
   - Draft constraints (objective count, KRs per objective)
4. **Data + diagnostics**
   - API status indicator
   - Export debug JSON (optional)

### Component list
- PageHeader
- SettingsSection
- Toggle / Select / NumberInput
- APIStatusPill
- SecondaryActionButton

### States
- **Empty:** show defaults populated.
- **Loading:** section skeletons.
- **Error:** inline per-section error + retry/save disabled.

### Mobile considerations
- One settings group per accordion.
- Avoid deep nesting; max two levels.

---

## Cross-screen UX rules

- Keep one dominant action per screen.
- Use consistent feedback language:
  - Info: “Generating draft…”
  - Success: “Saved.” / “Check-in saved.”
  - Error: actionable + retry.
- Preserve user input on API errors.
- Use optimistic updates only where rollback is simple (check-ins list).

---

## Immediate quick wins for current prototype

1. **Split single page into tabs/routes now**
   - `Overview | OKRs | Check-ins` as first step (History/Settings can follow).
2. **Add clear loading/disabled states on all async buttons**
   - Generate, Save, Submit check-in.
3. **Add validation before save**
   - Required objective title, KR title, target value.
4. **Improve hierarchy with sticky action bar**
   - Keep Save visible while editing long KR lists.
5. **Convert KR rows to cards on small screens**
   - Better readability and less horizontal scrolling.
6. **Standardize feedback placement**
   - Inline field errors + top toast for operation results.
7. **Add empty-state CTAs**
   - “No OKR yet” should directly point to “Generate draft”.
8. **Persist user context in UI**
   - Show selected quarter and last saved timestamp in header.

---

## Suggested implementation sequence (UI refactor)
1. Add app shell + nav.
2. Move existing generate/edit/save into OKRs page.
3. Move existing check-in flow into Check-ins page.
4. Add Overview summary page using existing API reads.
5. Add consistent state components (empty/loading/error) reused across screens.
6. Add History page as read-only timeline.
7. Add minimal Settings page.
