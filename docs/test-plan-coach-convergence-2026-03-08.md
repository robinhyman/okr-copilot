# Test Plan — Coach Convergence Increment (2026-03-08)

## 1) Purpose and scope
This plan defines **acceptance + regression** testing for the next OKR Coach increment focused on:
- reducing semantic loops,
- improving convergence under ambiguity,
- enforcing draft-on-request behavior,
- preserving OKR artifact quality,
- supporting release-go/no-go with auditable evidence.

Source-of-truth feedback: `okr-coach-expert-review-2026-03-08.md`.

---

## 2) Quality goals for this increment
1. Produce a usable draft quickly even with partial inputs.
2. Prevent repeated intent-equivalent questions (>2 asks/slot).
3. Surface progress transparently (Known/Inferred/Missing state).
4. Ensure saved drafts use collected evidence (no generic fallback when numeric context exists).
5. Maintain OKR rigor: objective + exactly 3 measurable KRs (lagging, leading, guardrail).

---

## 3) Deterministic scenario matrix (acceptance)

### Legend
- **Priority:** P0 = release-blocking, P1 = high-value, P2 = nice-to-have.
- **Type:** A = acceptance, R = regression, S = stress.
- **Verdict:** Pass/Fail based on expected outcome and thresholds in Section 6.

| ID | Pri | Type | Scenario | Setup / Input pattern | Deterministic expected behavior | Evidence required |
|---|---|---|---|---|---|---|
| CVG-A01 | P0 | A | Ambiguous start, rough numbers | User gives fuzzy problem + rough baselines/targets | By <= turn 6, coach outputs usable draft (objective + 3 KRs) with assumptions where needed | Full transcript + turn index of first usable draft |
| CVG-A02 | P0 | A | Finalize-on-demand with one unresolved field | User explicitly says “finalize now” while one slot missing | Coach must draft in same/next turn with assumptions/TBD; no refusal loop | Transcript excerpt of request/response pair |
| CVG-A03 | P0 | A | Repetition cap enforcement | User avoids exact answer for same slot for 3 turns | Coach asks max 2 intent-equivalent questions for slot, then shifts to synthesis + constrained options or assumption-based drafting | Intent-class annotation over turns |
| CVG-A04 | P0 | A | Evidence utilization | Transcript includes concrete numeric context | Generated draft incorporates numeric evidence; no generic placeholder objective/process KR | Side-by-side evidence map (input facts -> output fields) |
| CVG-A05 | P0 | A | KR structural integrity | Any standard planning flow | Final artifact contains objective + exactly 3 KRs tagged lagging/leading/guardrail, each measurable and quarter-bounded | Artifact lint report + transcript |
| CVG-A06 | P0 | A | Known/Inferred/Missing on blocking turns | Blocking clarification moment occurs | Response contains compact Known/Inferred/Missing field-state map | Transcript excerpt |
| CVG-A07 | P0 | A | Scope correction midstream | User narrows scope (e.g., mixed -> new-business only) | Coach acknowledges scope change and updates draft/assumptions immediately | Before/after draft diff |
| CVG-R01 | P0 | R | Baseline transcript replay | Replay baseline transcript from prior test pack | Maintains/ improves final output quality without added loops | Replay transcript + rubric score |
| CVG-R02 | P0 | R | Contrast transcript replay | Replay contrast transcript pattern | Now converges to usable draft (previously failed path) | Replay transcript + pass verdict |
| CVG-R03 | P1 | R | Numeric sparsity regression | Only one KR has precise baseline | Coach still drafts complete 3-KR set, marking confidence/TBD correctly | Artifact with confidence tags |
| CVG-R04 | P1 | R | User style shift regression | User moves from narrative to bullet metrics | Coach switches to synthesis mode and avoids repetitive open questions | Transcript with mode transition evidence |
| CVG-S01 | P0 | S | Ambiguity/loop stress (semantic paraphrase) | User answers with paraphrases that partially overlap | Semantic dedup guard still prevents >2 intent-equivalent asks | Similarity/intent trace |
| CVG-S02 | P0 | S | Contradictory metric stress | User provides conflicting values across turns | Coach flags conflict, chooses explicit assumption, proceeds with draft | Conflict resolution note in transcript |
| CVG-S03 | P1 | S | Noise injection stress | Insert irrelevant details between useful facts | Coach preserves state and progresses; does not reset discovery loop | State continuity trace |
| CVG-S04 | P1 | S | Turn-budget stress | Long clarifications without exact slot closure | Usable draft still delivered by turn budget (<=6 normal, <=8 stressed) | Turn count + artifact timestamp |

---

## 4) Transcript-quality suite design

### 4.1 Suite composition
- **Gold acceptance set (P0):** CVG-A01..A07 (7 scenarios)
- **Critical regression replays (P0):** CVG-R01..R02 (2 scenarios)
- **Stress set (P0/P1):** CVG-S01..S04 (4 scenarios)
- **Extended regressions (P1):** CVG-R03..R04 (2 scenarios)

Total: **15 scenarios** per release candidate.

### 4.2 Transcript quality rubric (scored per scenario)
Score each 1–5:
1. Convergence speed
2. Question non-redundancy
3. Context utilization
4. Transparency (Known/Inferred/Missing + assumptions)
5. Draft usability (manager-ready)
6. OKR structural quality (objective + lagging/leading/guardrail)

**Scenario pass rule:**
- Average score >= 4.0,
- No dimension < 3,
- All deterministic assertions satisfied.

### 4.3 Determinism controls
- Fixed scenario prompts and seeded user turns.
- Fixed scoring rubric and intent-class labeling guide.
- Fixed expected artifacts with tolerance rules (wording may vary; structure/logic must not).
- Evaluation done by two raters for all P0 fails and borderline passes.

---

## 5) Ambiguity + loop stress tests (detailed)

### ST-1: Slot-lock loop breaker
- **Goal:** Ensure single missing field does not stall entire flow.
- **Method:** Keep one slot unresolved for 4 turns while providing other useful context.
- **Pass:** max 2 asks for unresolved slot; then synthesis/options or assumption-draft path.

### ST-2: Semantic repeat trap
- **Goal:** Catch intent-equivalent re-asks with varied wording.
- **Method:** Prompt set induces repeated “main problem” intent.
- **Pass:** no third intent-equivalent ask; coach moves to confirmation framing or options.

### ST-3: Finalize-now override
- **Goal:** Validate non-refusal drafting rule.
- **Method:** User requests final draft before full closure.
- **Pass:** draft produced immediately with assumptions/TBD + confidence markers.

### ST-4: Conflicting inputs under pressure
- **Goal:** Validate uncertainty handling without freezing.
- **Method:** Provide mutually inconsistent baseline values late in conversation.
- **Pass:** coach identifies conflict, selects/asks one bounded decision, proceeds to usable draft.

---

## 6) Go/No-Go thresholds (release gate)

## 6.1 Mandatory gates (all must pass)
1. **P0 scenario pass rate:** 100% (no exceptions).
2. **Draft-on-request compliance:** >= 95% across suite, and **100% on P0 scenarios**.
3. **Semantic repetition violations:** < 5% sessions; **0 violations in P0 scenarios**.
4. **Time-to-first-usable-draft (TTFUD):** median <= 5 user turns; P90 <= 7.
5. **No-generic-save rule:** 0 cases where numeric evidence exists but output is generic fallback.
6. **KR integrity:** 100% of accepted artifacts include exactly 3 measurable KRs with lagging/leading/guardrail coverage.
7. **Evidence pack completeness:** 100% of required artifacts present (Section 7).

## 6.2 Conditional tolerance (non-blocking)
- P1 scenario failures allowed up to 1 minor fail **only if**:
  - no P0 impact,
  - documented mitigation exists,
  - fix is scheduled next patch cycle.

## 6.3 Decision model
- **GO:** All mandatory gates pass.
- **NO-GO:** Any mandatory gate fails, or evidence is incomplete/un-auditable.

---

## 7) Evidence pack requirements (release audit)

Each candidate must provide a single evidence bundle folder with:

1. **Scenario execution log**
   - scenario ID, date/time, tester, build hash/model config, pass/fail.
2. **Full transcripts (raw + normalized)**
   - one file per scenario; turn numbers preserved.
3. **Assertion checklist per scenario**
   - deterministic checks with explicit pass/fail marks.
4. **Rubric scoring sheets**
   - per-dimension scores + comments; dual-rater notes for disputes.
5. **Metric summary report**
   - TTFUD, draft-on-request compliance, repetition violations, fallback avoidance.
6. **Artifact quality report**
   - KR structure validation + evidence utilization mapping.
7. **Failure triage log**
   - severity, reproducibility steps, suspected root cause, retest result.
8. **Gate decision note**
   - explicit GO/NO-GO signed by QA + Release Gate owners.

**Evidence quality bar:** every fail must be reproducible from attached transcript + scenario seed; every pass must cite assertion evidence, not opinion-only commentary.

---

## 8) Severity model for defects
- **S0 (Blocker):** Violates mandatory gate (e.g., refuses finalize-now, loops >2 asks, generic fallback with available numeric evidence).
- **S1 (Critical):** Usable draft produced but missing required KR structure/measurement integrity.
- **S2 (Major):** Converges with degraded UX/transparency; recoverable without rewriting artifact.
- **S3 (Minor):** Tone/microcopy quality issues with no structural impact.

Release rule: any open **S0/S1 => NO-GO**.

---

## 9) Retest policy
- Retest required for every S0/S1 fix using:
  - the original failing scenario,
  - at least one adjacent regression scenario from same risk class.
- “Pass on rerun” is insufficient without updated evidence pack entries.

---

## 10) Execution order (recommended)
1. Run all P0 acceptance scenarios (CVG-A01..A07).
2. Run P0 transcript replays (CVG-R01..R02).
3. Run P0/P1 stress suite (CVG-S01..S04).
4. Run P1 regressions (CVG-R03..R04).
5. Compile metrics + gate checklist + decision.

---

## 11) Final release checklist (QA + Gate)
- [ ] All P0 scenarios passed
- [ ] No mandatory gate violation
- [ ] Evidence pack complete and reproducible
- [ ] GO/NO-GO note explicitly recorded
- [ ] Required fixes documented if NO-GO

---

## 12) Expected outcome for this increment
If this plan passes at GO level, the increment is considered ready to demonstrate **coach convergence under ambiguity** with materially reduced loop risk and auditable quality discipline.