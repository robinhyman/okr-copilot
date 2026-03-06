# Manager Action Digest — Graphical Redesign Spec

## 1) Goals

1. Make the **manager digest scan-friendly in <10 seconds** (what is urgent, why, and what to do now).
2. Bring manager experience visually closer to the richer **Senior leader rollup snapshot** style.
3. Preserve current utility (risk reasons + quick actions) while improving signal hierarchy.
4. Keep implementation incremental by reusing existing CSS patterns (`leader-*`, `status-pill`, `overview-card`, `badge`, `history`) and current data contract.

---

## 2) Current-state comparison (baseline)

### Current Manager digest (in `OverviewDashboard.tsx`)
- Text-heavy list (`ul.history`) with up to 3 items.
- Status and reasons shown as generic badges.
- Minimal visual hierarchy between summary, issue severity, and actions.
- No trend/composition visualization; limited “at-a-glance” quality view.

### Senior leader snapshot (in `LeaderRollupSnapshot.tsx` + `styles.css`)
- Clear card system with dedicated sections.
- Visual encodings: donut, stacked bars, mini trend bars, legend, delta cue.
- Consistent color mapping (`on-track`, `needs-attention`, `off-track`).
- Stronger density + readability with compact, graphical blocks.

**Design direction:** Apply the same dashboard language to manager digest, but optimize for **action execution** (not just monitoring).

---

## 3) Information architecture

Create a 3-layer structure inside manager digest:

1. **Header + health summary**
   - Title + generated timestamp (if available).
   - Risk mix (on track / at risk / off track).
   - Data quality snapshot (stale count, blockers count).

2. **Prioritized action queue (top 3)**
   - Each item as an action card with:
     - KR + objective
     - Severity/meta strip
     - Reason chips
     - Suggested next action
     - Quick actions (nudge/check-in)

3. **Compact trend/quality panel**
   - “Operational hygiene” bars (stale vs fresh, blockers vs clear).
   - Optional (future): week-over-week at-risk delta.

---

## 4) Component layout / textual wireframe

```text
[Manager Action Digest]  [Generated 16:22]
[On track 8 | At risk 3 | Off track 1]  (mini stacked bar)
[Quality: 2 stale | 1 blocked]          (quality badges)

┌────────────────────────────────────────────────────────────┐
│ Priority Actions                                           │
│                                                            │
│ [#1] Reduce churn                    [AT RISK pill] [72]   │
│      Improve retention objective                           │
│      [Stale updates] [Regression] [2 blockers]             │
│      Next action: Run recovery plan with KR owner          │
│      (Nudge owner) (Schedule check-in)                     │
│                                                            │
│ [#2] ...                                                   │
│ [#3] ...                                                   │
└────────────────────────────────────────────────────────────┘

┌──────────────────────────────┬──────────────────────────────┐
│ Digest quality               │ Actionability                │
│ stale ███░░ 2/5             │ high risk 2                  │
│ blockers ██░░░ 1/5          │ quick wins 1                 │
└──────────────────────────────┴──────────────────────────────┘
```

Desktop: 2-column lower row. Mobile: all blocks stacked.

---

## 5) Visual encodings

1. **Status composition mini-bar** (new)
   - Horizontal 100% stacked bar from `summary.on_track/at_risk/off_track`.
   - Reuse existing palette:
     - on-track: green
     - at-risk/needs-attention: amber
     - off-track: red

2. **Severity chip** (per item)
   - Keep risk score as numeric pill (`risk 72`) but style by threshold:
     - >=70 critical, 40–69 warning, <40 neutral.

3. **Reason chips**
   - Keep max 2–3 reasons; use subtle icon/prefix style (e.g., `⚠ Regression`, `🧱 Blockers`).
   - Preserve `reasonLabel()` mapping.

4. **Quality bars**
   - Two thin progress bars:
     - stale ratio (`staleCount / items.length`)
     - blocker ratio (`blockerCount / items.length`)

5. **Priority rank marker**
   - Simple left accent + rank number for top actions (`#1`, `#2`, `#3`) to enforce order.

---

## 6) Interaction patterns

1. **Primary quick actions remain inline**
   - Keep existing buttons: `Nudge owner`, `Schedule check-in`.
   - Convert action feedback to per-item inline toast/message (instead of one global status) for clarity.

2. **Progressive disclosure**
   - Default: condensed reason chips.
   - Expand on click (“View detail”) for blockers, confidence, progress delta.

3. **Sort strategy**
   - Default ordering by highest urgency:
     1) `off_track`
     2) higher `riskScore`
     3) more stale days

4. **Hover/focus affordances**
   - Card border accent on hover/focus-within for keyboard discoverability.

---

## 7) Responsive behavior

- **>= 900px:**
  - Header summary row + action list + 2-up subcards (quality/actionability).
- **< 900px:**
  - Stack all blocks vertically.
  - Keep action buttons wrapping onto multiple lines.
  - Maintain minimum tap target size (44px).

Leverage existing media-query patterns already used by `.leader-rollup-grid`.

---

## 8) Accessibility considerations

1. Do not rely on color alone:
   - Status text always visible (`At risk`, `Off track`).
2. Add semantic labels:
   - `aria-label` for stacked bars and quality meters.
3. Keyboard:
   - Ensure action buttons and detail toggles are tab reachable and show visible focus.
4. Screen-reader summaries:
   - Add concise SR-only line per card (risk + stale + blocker state + action).
5. Contrast:
   - Keep chips/pills at WCAG AA contrast in light theme.

---

## 9) Implementation notes mapped to existing code

## A. `apps/web/src/components/OverviewDashboard.tsx`

1. Extract manager digest into a dedicated component:
   - `ManagerActionDigestSnapshot` (new file, similar pattern to `LeaderRollupSnapshot`).
2. Keep existing helper functions:
   - `reasonLabel()`, `suggestAction()`.
3. Compute derived values once:
   - `staleCount`, `blockerCount`, total, ratios, sorted `prioritizedItems`.
4. Replace current inline `<section className="panel nested" ...>` with new component render.

## B. New component file

- `apps/web/src/components/ManagerActionDigestSnapshot.tsx`
  - Props: current `ManagerDigest` type + optional action callbacks.
  - Sections:
    - header summary
    - mini stacked status bar
    - prioritized action cards
    - quality/actionability subcards

## C. `apps/web/src/styles.css`

Add manager-specific dashboard styles, mirroring leader patterns:
- `.manager-digest-snapshot`
- `.manager-digest-grid`
- `.manager-digest-card`
- `.manager-status-stack` + segment modifiers (`.on-track/.needs-attention/.off-track`)
- `.manager-action-list`, `.manager-action-card`, `.manager-priority-index`
- `.manager-quality-meter`, `.manager-meter-fill`

Prefer shared utility classes where possible to avoid style drift.

## D. Testing (`apps/web/src/components/OverviewDashboard.test.ts`)

Update/add assertions for:
- New graphical section heading/copy.
- Presence of status composition meter.
- Presence of top priority card markers.
- Existing action labels (`Nudge owner`, `Schedule check-in`) remain intact.

---

## 10) Suggested rollout

1. **Phase 1 (safe visual uplift):** New layout + meters + prioritized cards, no data contract changes.
2. **Phase 2 (interaction polish):** expandable details + per-item action feedback.
3. **Phase 3 (insight depth):** optional trend over time once digest history is available.

This preserves current behavior while moving manager digest to a clear, graphical, dashboard-grade experience aligned with leader snapshot styling.