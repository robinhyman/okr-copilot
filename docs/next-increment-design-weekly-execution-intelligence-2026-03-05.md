# OKR Co-pilot — Next Increment Design (Design Only)

Date: 2026-03-05  
Prepared for: Robin

## Goal
Define what functionality the next increment should include, based on representative user perspectives (manager, team member, senior leader), building on the existing multi-user + multi-team RBAC foundation.

---

## 1) User discovery synthesis

## A) Manager
> “I can set OKRs, but I still spend too much time chasing updates and rewriting vague key results.”

**Top goals**
1. Keep team OKRs aligned to quarterly priorities.
2. Get reliable progress visibility without manual chasing.
3. Improve KR quality (clear, measurable, owner-assigned).

**Top pain points in current increment**
1. Inconsistent and late progress updates.
2. KR quality varies significantly.
3. Hard to identify at-risk KRs early across teams.

**Highest-value next capabilities**
- Guided weekly check-ins with lightweight nudges.
- At-risk detection with manager digest.
- KR quality coaching during create/edit.

**Risks/concerns**
- Reminder fatigue.
- Generic AI guidance.
- Increased reporting overhead.

---

## B) Team member
> “I know my tasks, but I’m not always sure how my work maps to the key result.”

**Top goals**
1. Understand personal impact on team outcomes.
2. Update progress quickly with low friction.
3. Get support when blocked.

**Top pain points in current increment**
1. Update workflow feels detached from work rhythm.
2. KR wording can be ambiguous.
3. Dependencies/escalation paths are unclear.

**Highest-value next capabilities**
- 2-minute check-in flow.
- “My impact” view linking owned KRs to objectives.
- Smart prompts when confidence drops.

**Risks/concerns**
- Confidence data used punitively.
- Low trust in weak recommendations.
- Notification overload.

---

## C) Senior leader
> “I need a clear cross-team signal: where we’re on track, where intervention is needed, and why.”

**Top goals**
1. Read strategic progress across teams quickly.
2. Ensure alignment and reduce conflicting goals.
3. Intervene earlier on risk.

**Top pain points in current increment**
1. Limited risk narrative beyond progress %.
2. Cross-team rollups are hard to compare.
3. Unclear data freshness and consistency.

**Highest-value next capabilities**
- Executive health dashboard with trend.
- Standardized risk reason codes.
- Weekly auto-summary by org/unit.

**Risks/concerns**
- Over-aggregation can hide root causes.
- Data quality issues reduce trust.
- Teams may game confidence metrics.

---

## 2) Recommended next increment

## Problem statement
The app supports OKR setup and role-based collaboration, but execution rhythm is weak: updates are inconsistent, risk is discovered late, and leadership lacks a trusted, timely signal.

## Recommended increment theme
**Weekly Execution Intelligence**

### In scope (1 sprint)
1. **Structured weekly check-ins**
   - Progress delta, confidence, blocker tag, optional note.
2. **At-risk signals + manager digest**
   - Prioritized intervention list for team managers.
3. **Executive rollup snapshot**
   - On-track/at-risk/off-track + trend with drill-down.
4. **KR quality guidance**
   - Inline prompts during KR create/edit (non-blocking).

### Out of scope
- Predictive forecasting engine.
- Deep external PM integrations.
- Advanced custom analytics builder.
- Large-scale strategy generation workflows.

---

## 3) Prioritized feature list

### Must
1. Weekly check-in flow (team-member friendly, low friction).
2. Risk classification + manager digest.
3. Leadership rollup view with trend + drill-down.

### Should
4. KR quality coach (measurability, ownership, timeframe, baseline).
5. “My impact” contribution view.

### Could
6. Adaptive reminder nudges.
7. Standard blocker taxonomy for cleaner rollups.

---

## 4) UX flow overview

1. **Team member:** Home → “Check-ins due” → submit progress/confidence/blockers quickly.
2. **Manager:** Team dashboard → digest cards (newly at-risk, stale updates, blocker clusters) → drill-down.
3. **Senior leader:** Org snapshot → trend + risk by team → inspect top strategic risks.
4. **KR author:** Create/edit KR → quality hints inline → accept/ignore suggestions.

---

## 5) API/data implications (high-level)

- Extend/add entities for:
  - Check-ins (progress delta, confidence, blocker tags, notes)
  - Risk signals (severity + reason codes + trend)
  - KR quality flags/score
- Add RBAC-scoped read models for manager digest + executive rollup.
- Preserve team boundaries and leader read-only semantics.
- Ensure auditability of confidence/risk-related changes.

---

## 6) Acceptance criteria

1. Team members can complete check-ins in <2 minutes per KR.
2. Managers can view prioritized at-risk items with reason codes.
3. Senior leaders can view cross-team health and trend in one place.
4. KR create/edit surfaces actionable quality guidance.
5. RBAC remains correct for all role/team combinations.

---

## 7) Success metrics (first 4–6 weeks)

- Weekly check-in completion rate: +30% vs baseline.
- On-time KR updates: >80% weekly.
- Earlier manager intervention: risk surfaced at least 1 week earlier.
- Stale KR reduction (>7 days without update): -40%.
- KR quality completeness uplift: +25%.

---

## 8) Open questions / assumptions

1. Confidence scale: RAG vs numeric (global or team-configurable)?
2. Blocker visibility defaults by role?
3. Minimum trend window for trustworthy leadership signal (2w vs 4w)?
4. Digest channel in this increment: in-app only or include email/Slack later?
5. Confirm owner-based KR update semantics for all team-member cases.

---

## 9) One-sprint design plan (no implementation detail)

### Workstreams
- **Product:** finalize scope, KPI baseline, and risk taxonomy.
- **Design:** prototype check-in, digest, and rollup information hierarchy.
- **Engineering (planning):** validate feasibility and API/read-model shape.
- **QA/Test (planning):** define RBAC scenario matrix and interpretation checks.

### Dependencies
- Stable team membership + KR ownership model.
- Existing RBAC read/write controls.

### Risks + mitigations
1. Low check-in adoption → keep flow extremely short and useful.
2. Low trust in risk signals → transparent reason codes + drill-down evidence.
3. Alert overload for managers → prioritize top actionable items only.
4. Permission leakage risk → role-team regression checks as release gate.

---

## Final recommendation — what to build next and why
Build **Weekly Execution Intelligence** next.

It directly addresses the highest shared pain across all user profiles: weak execution visibility between planning and review. It is strongly aligned with the current RBAC + multi-team base, delivers immediate user-facing value in one sprint, and improves both team behavior (consistent updates) and leadership decisions (earlier risk detection) without adding unnecessary platform complexity.
