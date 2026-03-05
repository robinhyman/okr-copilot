# OKR Co-Pilot — Conversational OKR Coach Wireframes
**Date:** 2026-03-05  
**Designer:** UI Subagent  
**Format:** Low-fidelity desktop wireframes (SVG)

## 1) Goal
Design a compact, clarity-first flow for creating OKRs through a conversational coach, starting from a single **Create** action, generating a full draft (Objective + KRs), enabling iterative refinement through chat, and supporting save-as-draft + later publish.

## 2) Core UX Principles
- **Single clear entry point:** one primary Create CTA.
- **Conversation-first creation:** no manual KR row entry during initial flow.
- **Dual-pane confidence:** coach conversation + draft preview/review.
- **Continuous refinement:** user can continue chatting after draft generation.
- **Safe progression:** save draft anytime; publish only when ready.
- **Compact desktop layout:** minimal chrome, focused work area, clear hierarchy.

## 3) Information Architecture
1. **Dashboard / OKR list**
   - Global Create button
   - Existing Drafts + Published lists
2. **Coach Session**
   - Left: chat timeline + quick prompt chips + composer
   - Right: “Draft Preview” card (initially empty, then live generated)
3. **Draft Review & Refine**
   - Right pane upgrades to structured objective + KR cards + confidence/status
   - Actions: Save Draft, Regenerate, Publish
4. **Drafts & Publish Management**
   - Draft list with metadata and status
   - Reopen draft into conversation context
   - Final validation + publish flow

## 4) Screen-by-Screen Wireframe Spec

### Screen 01 — Create Entry
**File:** `docs/wireframes/01_create_entry.svg`

**Purpose:** Start OKR creation from one obvious CTA.

**Key regions:**
- Top nav: product name, period selector, user menu.
- Main content:
  - Section title: “OKRs”
  - Primary button: **Create OKR with Coach**
  - Two list containers:
    - Draft OKRs
    - Published OKRs
- Right utility rail:
  - Tips card: “How Coach works”
  - Recent activity mini-feed

**Primary states shown:**
- Empty-ish draft list with call to action.
- Existing published examples for context.

---

### Screen 02 — Coach Conversation
**File:** `docs/wireframes/02_coach_conversation.svg`

**Purpose:** Guided question-and-answer flow that captures intent before generating draft.

**Key regions:**
- Header with breadcrumb: `OKRs / New / Coach Session` + session status.
- Two-column workspace:
  - **Left (conversation):**
    - Coach welcome prompt
    - User response bubbles
    - Follow-up coach questions
    - Suggested reply chips (e.g., “Growth”, “Customer Retention”, “Efficiency”)
    - Composer with placeholder: “Answer the coach…” + Send button
  - **Right (draft preview placeholder):**
    - “Draft Preview (building…)”
    - Skeleton/placeholder blocks for Objective and KRs
    - Note: “Coach will draft after enough context.”
- Footer actions:
  - Save Draft (secondary)
  - Cancel

**Primary states shown:**
- In-progress interview phase.
- Draft not yet fully generated.

---

### Screen 03 — Draft Review & Refine
**File:** `docs/wireframes/03_draft_review_refine.svg`

**Purpose:** Present generated full draft while keeping chat open for iterative refinement.

**Key regions:**
- Header: draft title + status badge “Draft”.
- Left pane (chat):
  - Recent refinement request from user
  - Coach refinement suggestion
  - Composer + quick commands (e.g., “Make KRs more measurable”, “Shorten objective”)
- Right pane (structured draft):
  - Objective block
  - KR1, KR2, KR3 cards with metric + target + owner placeholders
  - Quality checks (clarity/measurability/alignment)
- Sticky action bar:
  - Regenerate KRs
  - Save Draft
  - Publish (primary)

**Primary states shown:**
- Generated draft present.
- User continues chat-led refinement.

---

### Screen 04 — Drafts and Publish
**File:** `docs/wireframes/04_drafts_and_publish.svg`

**Purpose:** Revisit drafts and publish when ready.

**Key regions:**
- Left list panel: Drafts table/list
  - Name, updated time, owner, readiness score
  - Filter tabs: All / Mine / Needs review
- Main panel: selected draft details
  - Objective + KR summary
  - Last coach note
  - “Resume in Coach” action
- Right validation panel:
  - Checklist (objective outcome-focused, KRs measurable, targets realistic)
  - Blocking warnings area
  - Publish confirmation card
- Bottom actions:
  - Save Changes
  - Publish OKR

**Primary states shown:**
- Draft lifecycle management.
- Final pre-publish confidence gates.

## 5) Interaction Notes
- **Create click** launches Coach Session immediately.
- Coach asks 3–6 staged questions before first complete draft.
- Draft preview updates progressively; full draft appears after minimum context threshold.
- Any user prompt after draft generation updates draft via conversational refinement.
- Save Draft available at all times; publish available once validation checks pass.
- Reopening a draft restores both draft content and condensed conversation context.

## 6) Copy & Label Guidance (Demo-ready)
- Use direct labels: “Create OKR with Coach”, “Resume in Coach”, “Regenerate KRs”, “Publish OKR”.
- Coach tone: concise, strategic, metric-aware.
- System feedback examples:
  - “Draft saved 2m ago”
  - “2 validation checks need attention before publish”

## 7) Visual Direction (Low-fi)
- Greyscale wireframe style with subtle blue accents for primary actions.
- Clear spacing rhythm (8/16/24).
- Dense but readable desktop layout (~1366×900 target).
- Rounded cards and lightweight borders for modern UI skeleton.

## 8) Artifacts Delivered
- `docs/wireframes/01_create_entry.svg`
- `docs/wireframes/02_coach_conversation.svg`
- `docs/wireframes/03_draft_review_refine.svg`
- `docs/wireframes/04_drafts_and_publish.svg`
