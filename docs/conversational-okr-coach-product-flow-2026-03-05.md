# Conversational OKR Coach — Product Flow (OKR Co-Pilot)
**Date:** 2026-03-05  
**Owner:** Product  
**Scope:** End-to-end creation and refinement flow for fully conversational, LLM-driven OKR drafting in a multi-user team context.

---

## 1) Problem Statement and Goals

### Problem statement
Current OKR creation experiences often rely on rigid forms and manual key result (KR) entry, which creates friction, leads to low-quality goals, and increases abandonment. Users struggle to:
- translate broad strategy into measurable outcomes,
- write high-quality KRs without coaching,
- align goals across teams,
- and iterate quickly before publishing.

For OKR Co-Pilot, we need a **conversation-first flow** where users can move from idea to publishable OKR draft through guided dialogue—without manual KR input boxes in creation.

### Product goals
1. **Reduce friction:** Replace form-first creation with a single “Create” action that starts a coaching conversation.
2. **Improve quality:** Use adaptive questioning to gather context and propose complete draft OKRs (objective + full KR set).
3. **Enable iteration:** Support ongoing back-and-forth refinement until confidence is high.
4. **Preserve progress:** Allow save/revisit at any point before publish.
5. **Support organizations:** Work in multi-user, multi-team environments with role-based permissions and auditability.

### Non-goals (for this phase)
- Full annual planning workflow orchestration across all departments.
- Automated OKR scoring during creation.
- Heavy analytics dashboards beyond essential draft quality and conversion metrics.

---

## 2) End-to-End User Journey and States

## Primary user journey
1. **Entry**
   - User navigates to OKRs and clicks **Create**.
   - User selects scope/context if needed (e.g., Team, Department, Company cycle).
2. **Conversation kick-off**
   - LLM coach introduces process, confirms planning context (period, team, strategic priorities).
3. **Context discovery**
   - LLM asks iterative, adaptive questions.
   - User responds in natural language.
4. **Draft synthesis**
   - LLM proposes a complete draft: 1 Objective + recommended KR set.
5. **Refinement loop**
   - User asks for changes (e.g., make KR more measurable, reduce scope, increase ambition).
   - LLM updates draft and explains trade-offs briefly.
6. **Save/revisit**
   - User can save as draft at any point.
   - Draft remains editable via conversation history.
7. **Publish readiness check**
   - System validates policy/completeness (required fields, permissions, conflicts if any).
8. **Publish**
   - User publishes when satisfied.
   - Draft becomes active OKR version in appropriate workspace/team scope.

### User states model
- **S0: Not started** — no draft exists.
- **S1: Conversational discovery** — context gathering in progress.
- **S2: Initial draft proposed** — first full objective + KR set generated.
- **S3: Refining draft** — iterative edits via conversation.
- **S4: Saved draft (unpublished)** — paused for later revisit.
- **S5: Ready to publish** — validations pass and user has permission.
- **S6: Published** — immutable published version created; future edits handled via versioning.

### Key transitions
- S0 → S1: Click Create.
- S1 → S2: LLM reaches sufficient context threshold.
- S2 ↔ S3: User requests edits; LLM revises.
- S1/S2/S3 → S4: Save draft.
- S4 → S3: Reopen and continue conversation.
- S3/S4 → S5: User indicates readiness and validations pass.
- S5 → S6: Publish action executed by authorized role.

---

## 3) Conversation Design

### Design principles
- **Coaching over form filling:** user describes intent; system structures outcomes.
- **Progressive disclosure:** ask only what is needed next.
- **Adaptive depth:** novice users get more scaffolding; experienced users get concise prompts.
- **Outcome focus:** move conversation toward measurable business impact.
- **Low cognitive load:** avoid long questionnaires upfront.

### Questioning strategy
LLM should ask in rounds, each with clear objective:

1. **Orientation round**
   - Confirm planning period, scope, owner/team, and strategic anchor.
   - Example intents: “What must be true by end of quarter?”

2. **Objective framing round**
   - Identify desired outcome (not tasks).
   - Probe for business value, beneficiaries, and success condition.

3. **KR elicitation round**
   - Derive 2–5 measurable KRs tied to objective.
   - For each KR, probe baseline, target, metric definition, and confidence.

4. **Constraint/alignment round**
   - Check dependencies, resource constraints, risks, and cross-team alignment.

5. **Quality calibration round**
   - Check ambition level, clarity, and measurability.
   - Ask if user wants “safer” or “stretch” variant.

### Adaptive behavior rules
- If user gives vague input, ask narrowing questions.
- If user provides rich detail, skip redundant prompts.
- If confidence in required fields is low, request missing specifics before drafting.
- If user pushes to draft early, generate draft with explicit assumptions and mark uncertain elements.

### Stopping criteria for first draft generation
Generate full draft when all are true:
1. Objective direction and business outcome are clear.
2. Minimum KR count can be generated credibly for selected scope.
3. Each KR has measurable metric + target (or explicit placeholder flagged for follow-up).
4. Ownership and timeframe are known.
5. No blocking ambiguity remains (or assumptions are documented and user-approved).

### Refinement loop behavior
- User gives natural feedback (e.g., “KR2 is too output-focused”).
- LLM proposes revised wording and rationale.
- System highlights changes between versions (before/after).
- User can request:
  - tighten/loosen ambition,
  - merge/split KRs,
  - reframe objective,
  - align with another team’s OKR.
- Loop continues until user triggers save or publish.

---

## 4) Draft Lifecycle (Create/Save/Revisit/Publish/Versioning)

### Lifecycle entities
- **Conversation Thread:** chronological dialogue + system prompts + metadata.
- **Draft OKR:** structured current state (objective + KR set + context).
- **Draft Versions:** snapshots after meaningful updates.
- **Published OKR:** immutable release record tied to version.

### Lifecycle stages
1. **Create Draft**
   - Auto-created when conversation starts or first user message received.
2. **Auto-save + manual save**
   - Auto-save after each meaningful turn.
   - Explicit “Save draft” action for user confidence.
3. **Revisit Draft**
   - User reopens saved draft from drafts list.
   - Thread context is restored; LLM resumes with concise recap.
4. **Pre-publish validation**
   - Required checks: objective present, KR completeness, timeframe, ownership, permissions.
5. **Publish**
   - Publish creates immutable published version and status change.
6. **Post-publish edits via new version**
   - Editing published OKR creates a new draft version (not silent overwrite).

### Versioning expectations
- Every major LLM revision creates version checkpoint (v1, v2, …).
- User can compare versions and restore prior version before publish.
- Audit fields per version: author (user/LLM), timestamp, summary of changes.

### Draft integrity rules
- Single source of truth for “current draft state.”
- Conversation and structured draft remain synchronized.
- If sync conflict occurs, system surfaces reconciliation prompt before continuing.

---

## 5) Role and Permission Expectations (Multi-user/Team/RBAC)

### Core roles
- **Org Admin:** full visibility/control; configure policies and publish rights.
- **Team Manager / OKR Owner:** create, edit, and publish within team scope.
- **Contributor:** create/edit drafts in allowed scope; publish only if granted.
- **Viewer/Stakeholder:** read-only access to shared drafts/OKRs.

### Permission matrix (high-level)
- **Create conversation draft:** Admin, Manager, Contributor (scoped).
- **Edit own draft:** Admin, Manager, Contributor (owner or shared access).
- **Edit others’ drafts:** Admin/Manager per scope rules.
- **Publish draft:** Admin/Manager + explicit publish permission.
- **View conversation history:** participants + authorized reviewers.

### Team and workspace context
- Draft must be associated with explicit scope: personal, team, or company-level.
- LLM must be context-aware of selected team goals and existing OKRs (read-only unless user has edit rights).
- Cross-team references allowed; cross-team edits blocked unless permissioned.

### Collaboration expectations
- Support handoff (e.g., contributor prepares draft, manager publishes).
- Mention/comment workflow optional but recommended in future phases.
- All publish actions logged for audit/compliance.

---

## 6) Non-Functional Requirements and Guardrails

### Performance and reliability
- First response latency target: fast enough for conversational feel (e.g., <3s p50 for initial assistant response).
- Graceful fallback if LLM unavailable: preserve draft, show retry path, no data loss.
- Autosave reliability: no user turn should be lost.

### Safety and quality guardrails
- **No hallucinated business facts:** LLM should request clarification instead of inventing metrics/baselines.
- **Explicit assumptions:** uncertain fields flagged as assumptions.
- **Anti-pattern detection:** warn on activity/task KRs disguised as outcomes.
- **Scope sanity checks:** objective and KRs must match selected team/timeframe.

### UX guardrails
- No manual KR entry boxes in creation flow; KRs are created/refined via conversation.
- User can still make explicit textual edit requests (“rewrite KR3 to...”).
- Clear indication of draft status (unsaved, saved, ready, published).
- Persistent ability to pause and resume.

### Security and compliance
- RBAC enforcement at API/service layer (not only UI).
- Audit trail for create/edit/publish/version restore events.
- Data isolation by workspace/team.
- Retention policy for conversation logs configurable by organization.

### Accessibility and inclusivity
- Keyboard-first conversation interaction.
- Accessible status announcements for draft saves/validation errors.
- Plain-language fallback mode for non-OKR experts.

---

## 7) Acceptance Criteria and Success Metrics

### Functional acceptance criteria
1. User can click **Create** and immediately enter conversational flow.
2. Creation flow contains **no manual KR input boxes**.
3. LLM asks iterative, adaptive questions and gathers missing context.
4. LLM can produce complete draft (1 objective + full KR set) when criteria met.
5. User can refine draft in multi-turn conversation with visible updates.
6. Draft can be saved and reopened with full context preserved.
7. Only authorized users can publish, based on RBAC.
8. Publishing creates immutable version and audit entry.
9. Version history supports compare and restore pre-publish.

### Quality acceptance criteria
- At least one validation layer identifies non-measurable KR wording.
- System surfaces missing required context before publish.
- Draft status is always visible and accurate.

### Success metrics (first 1–2 quarters post-launch)
- **Draft completion rate:** % of Create sessions reaching first full draft.
- **Publish conversion rate:** % of drafts published within 14 days.
- **Time-to-first-draft:** median minutes from Create click to first complete draft.
- **Refinement depth:** average revision turns before publish (healthy range indicates engagement, not churn).
- **Quality score proxy:** % of published KRs passing measurability checks without manual intervention.
- **User satisfaction:** post-flow rating (e.g., CSAT for creation experience).
- **Abandonment points:** drop-off by state (S1, S2, S3, S4).

---

## 8) Open Questions for Stakeholder Feedback

1. **Minimum KR policy:** Should system enforce fixed KR count per objective or allow dynamic range by team?
2. **Assumption handling:** Can users publish with unresolved assumptions, or must all assumptions be resolved?
3. **Manager approval gate:** Is publish immediate for eligible users, or should certain scopes require approval workflow?
4. **Tone/persona of coach:** How directive should LLM be (coach vs co-writer)?
5. **Context sources:** Which internal artifacts should LLM reference by default (prior OKRs, strategy docs, roadmap)?
6. **Draft sharing defaults:** Private by default vs team-visible by default?
7. **Version granularity:** What counts as a “major change” requiring checkpoint?
8. **Post-publish edits:** Should users be able to hotfix typos without creating a new version?
9. **Localization:** Is multilingual coaching required in v1?
10. **Compliance constraints:** Any legal/regulated retention rules for conversation logs?

---

## Suggested Rollout (Practical)

### Phase 1 (MVP)
- Create → conversation → full draft → save/revisit → publish with RBAC.
- Basic validation and version history.

### Phase 2
- Smarter quality coaching, benchmark suggestions, improved change diffs.
- Better collaboration and manager review tooling.

### Phase 3
- Deeper strategic alignment integrations and advanced analytics.

This phased approach keeps v1 focused on core user value: fast, high-quality OKR creation through conversation rather than forms.