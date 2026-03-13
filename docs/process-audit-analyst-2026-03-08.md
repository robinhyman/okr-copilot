# Process Audit Report — Analyst

Date: 2026-03-08  
Author: Analyst sub-agent (role: `docs/agent-prompts/analyst.md` v2026-03-08.v1)

## 1) Current-state diagnosis (what is working vs overgrown)

### What is working well
- **Strong intent toward reliability**: repeated emphasis on proof-before-claim, done-gates, and explicit status formatting.
- **Safety posture is clear**: outbound lock, recipient constraints, and anti-misrouting rules are specific and auditable.
- **Delivery quality bar is high**: `product-increment-delivery-standard.md` + `development-operating-system.md` define an end-to-end loop from scope to handover.
- **Role clarity exists**: agent prompt pack gives clear role boundaries and output contracts.
- **Auditability mindset is present**: evidence notes, gate checks, GO/NO-GO logic, and routing reason logs.

### Where the process is overgrown
- **Rule duplication across files**: AGENTS.md, USER.md, OPERATING-RULES.md, and checklist restate near-identical communication/routing rules.
- **Mixed concerns in AGENTS.md**: identity, memory, comms locks, group-chat etiquette, heartbeat policy, software cadence, formatting, and tool behavior are all bundled.
- **Too many “mandatory” layers**: software quality gates exist in at least 3 places (AGENTS reliability/cadence, development operating system, product increment standard).
- **Potential instruction collisions**:
  - “Default normal in-thread reply” vs “tool-driven continuity confirmation” can conflict in channels lacking a second in-thread mechanism.
  - “No exceptions” phrasing appears in multiple docs with differing scope.
- **Enforcement ambiguity**: many items are policy text but not machine-gated, raising drift risk.

### Net diagnosis
Current system is **high-safety but high-friction**. Reliability intent is excellent, but maintainability is at risk due to duplicated policy surface and unclear canonical ownership.

---

## 2) Conflict/redundancy matrix (file-by-file)

| File | Primary value | Redundancy with | Conflict risk | Recommendation |
|---|---|---|---|---|
| `AGENTS.md` | Global behavior, safety, operating norms | USER.md, OPERATING-RULES.md, checklist, software standards | High (scope creep + duplicated mandates) | Keep as high-level constitution only; remove detailed operational duplicates |
| `USER.md` | Human profile/preferences/context | AGENTS comms guardrails | Medium | Keep personal preferences only; replace duplicated rules with reference to canonical rules |
| `OPERATING-RULES.md` | Quick operational canonical | AGENTS sections + checklist | Medium-low | Keep as canonical concise runtime policy (comms/routing/reliability) |
| `checklists/message-routing-checklist.md` | Decision procedure for routing | OPERATING-RULES routing section | Low | Keep as executable checklist; derive from OPERATING-RULES, no extra policy |
| `docs/development-operating-system.md` | Software execution loop and hard gates | product-increment-delivery-standard.md | Medium | Keep as orchestration layer; avoid restating detailed gate criteria |
| `docs/product-increment-delivery-standard.md` | Detailed DoD + validation gates + evidence pack | development-operating-system.md + AGENTS software cadence | Medium-high | Keep as canonical software quality standard; trim overlap elsewhere |
| `docs/agent-prompts/README.md` | Prompt-pack usage contract | minor overlap with development OS role section | Low | Keep; link to OS doc for role accountability |
| `docs/agent-prompts/*.md` | Distinct role constraints/output contracts | none significant | Low | Keep; good separation, lean and clear |

**Top redundancy hotspots**
1. Communication guardrails duplicated in AGENTS + USER + OPERATING-RULES.
2. Message routing duplicated in AGENTS + OPERATING-RULES + checklist.
3. Software “done/gate/evidence” duplicated in AGENTS + development OS + delivery standard.

---

## 3) Lean-core ruleset proposal (max 12 rules)

Proposed **Lean Core v1** (12 rules):

1. **Canonical precedence**: `AGENTS.md` (global principles) > `OPERATING-RULES.md` (runtime policy) > task-specific standards (`development-operating-system.md`, `product-increment-delivery-standard.md`) > role prompts.
2. **Single source per domain**: each policy domain has one canonical file; all others only reference it.
3. **Outbound lock**: no outbound/tool-driven communication except allowed recipient policy.
4. **Pre-work playback**: every direct instruction gets a separate `Got it — <paraphrase>` acknowledgment.
5. **Start immediately**: execution begins right after pre-work playback; no wait-for-OK.
6. **Routing single-path**: for each turn, use exactly one delivery path (normal reply OR tool-driven send).
7. **Tool-driven exception scope**: tool-driven messaging only for proactive alerts, channel-native actions, or background completions.
8. **Action-proof reporting**: no “working on it” claims without concrete execution evidence.
9. **Blocked-in-60 rule**: if execution cannot start within 60s, report blocker + next step.
10. **Software done gate**: no DONE claim unless required gate scripts + live access checks + seeded-data checks pass.
11. **Evidence artifact required**: each software increment must have/update one `docs/demo-<name>-<date>.md` evidence note.
12. **GO/NO-GO gate decision**: release gate must produce explicit auditable decision with blocking reasons if NO-GO.

---

## 4) What to merge/remove/archive now

### Merge now
- Merge all communication/routing/reliability operational text into `OPERATING-RULES.md` as canonical runtime policy.
- Keep checklist as procedural derivative of `OPERATING-RULES.md` only.

### Remove from non-canonical files
- Remove Communication Guardrails section from `USER.md` (replace with one-line pointer to `OPERATING-RULES.md`).
- Remove duplicated routing and software cadence blocks from `AGENTS.md`; retain only principles and links.

### Archive now
- Archive any superseded inline rule blocks in AGENTS as `docs/archive/policy-snippets-2026-03-08.md` (for traceability).

### Keep unchanged
- `product-increment-delivery-standard.md` (detailed quality spec)
- Role prompt files (`docs/agent-prompts/*.md`)

---

## 5) Which checks remain hard gates (scripts/tests) vs text policy

### Hard gates (should be script/test enforced)
1. `npm run done:proof` (API reachable, web reachable, non-empty seeded data).
2. Required build/test/typecheck commands for increment scope.
3. Presence/validation of evidence note (`docs/demo-*.md`) with required sections.
4. Persona validation artifact presence (at minimum structured PASS/PARTIAL/FAIL + evidence references).
5. Release GO/NO-GO checklist completion.

### Text policy (human/auditable, not full hard gate)
1. Pre-work playback wording and paraphrase quality.
2. Message path choice rationale (normal vs tool-driven).
3. Group-chat etiquette and reaction style.
4. “Voice/tone/persona” behavior.
5. Scope decomposition quality and architectural tradeoff narrative quality.

### Hybrid (light automation + policy)
- Routing compliance: lint logs for prohibited mixed-path events, but keep human review for edge cases.
- Action-proof updates: pattern checks for status format plus random audit of evidence validity.

---

## 6) Recommended final file architecture (canonical vs reference files)

### Canonical files
- `AGENTS.md` → **Global principles only** (safety, privacy, precedence, behavior philosophy).
- `OPERATING-RULES.md` → **Runtime communication/routing/reliability policy**.
- `docs/product-increment-delivery-standard.md` → **Software increment quality standard (DoD + gates)**.
- `docs/development-operating-system.md` → **Execution choreography (when/how standard is invoked)**.

### Reference/derived files
- `USER.md` → user profile/preferences/context only.
- `checklists/message-routing-checklist.md` → procedural checklist derived from `OPERATING-RULES.md`.
- `docs/agent-prompts/README.md` + role prompts → role execution references.

### Precedence banner to add at top of each doc
- “If conflict: follow `<canonical file>`.”
- This sharply reduces ambiguity during multi-file reads.

---

## 7) 7-day migration plan with low risk

### Day 1 — Freeze + inventory
- Freeze policy edits except emergency fixes.
- Create policy map with owner per file and canonical domain assignment.

### Day 2 — Canonicalization pass
- Refactor `OPERATING-RULES.md` into final canonical runtime policy.
- Add explicit precedence clauses.

### Day 3 — De-dup pass (safe edits)
- Strip duplicated guardrails from `USER.md` and duplicated operational blocks from `AGENTS.md`.
- Replace removed text with short links to canonical docs.

### Day 4 — Checklist sync
- Regenerate `message-routing-checklist.md` directly from `OPERATING-RULES.md`.
- Add “last synced from canonical on <date>”.

### Day 5 — Gate automation tightening
- Add/adjust scripts for evidence file validation and done-proof enforcement in CI/local checks.
- Ensure GO/NO-GO output template is standardized.

### Day 6 — Dry-run validation
- Run two sample increments through full process.
- Record friction points, false positives, and missed catches.

### Day 7 — Cutover + archive
- Finalize docs, archive superseded snippets, publish short “how to operate now” memo.
- Start metric tracking baseline (see section 8).

Risk controls throughout:
- Keep rollback branch with pre-migration docs.
- Only remove duplicated text after link replacements are live.
- Avoid changing quality thresholds during de-dup week.

---

## 8) Metrics to track reliability (leading + lagging)

### Leading indicators (predictive)
1. **Instruction conflict rate**: # sessions with conflicting directives encountered.
2. **Policy lookup latency**: median time to find canonical rule.
3. **Checklist adherence rate**: % tasks with required status/evidence format.
4. **Gate first-pass pass rate**: % increments passing done gates on first attempt.
5. **Duplicate-policy footprint**: total duplicated rule blocks across docs (target downward).

### Lagging indicators (outcomes)
1. **Misrouting incidents**: outbound/routing violations per week.
2. **False “done” incidents**: done claims later retracted due to missing proof.
3. **Post-handover defects**: defects found after release gate GO.
4. **Rework ratio**: % increments requiring major re-open within 72h.
5. **Cycle time to demo-ready**: request-to-demo-ready elapsed time.

### Suggested targets (first 30 days)
- Misrouting incidents: **0**.
- False done incidents: **0**.
- Gate first-pass pass rate: **≥70%** initially, improving to **≥85%**.
- Duplicate-policy footprint: **-50%** by end of migration week.
- Median policy lookup latency: **<30s**.

---

## Risk register (top 5)
1. **Over-consolidation risk**: removing context that was operationally useful.  
   Mitigation: archive before removal; 7-day rollback window.
2. **Silent drift risk**: checklist diverges from canonical rules.  
   Mitigation: sync stamp + scheduled weekly diff check.
3. **Gate fatigue risk**: too many checks slow throughput.  
   Mitigation: keep only high-signal hard gates scripted.
4. **Ambiguity at precedence boundaries**: unresolved conflicts across docs.  
   Mitigation: explicit precedence line in every policy file.
5. **Human non-adoption risk**: team keeps referencing old snippets.  
   Mitigation: deprecate with redirects; publish one-page operator guide.

## Final recommendation
Adopt a **two-tier control model**:
- Tier 1: **Lean policy core** (AGENTS principles + OPERATING-RULES runtime)
- Tier 2: **Delivery quality system** (Development OS + Product Increment Standard + role prompts)

This preserves your current reliability strengths while reducing policy bloat and conflict surface area.