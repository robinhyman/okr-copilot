# OKR Coach Expert Review — 2026-03-08

## Scope reviewed
- `/Users/assistant/.openclaw/workspace/okr-copilot/docs/test-manager-coach-transcript-2026-03-08.md`
- `/Users/assistant/.openclaw/workspace/okr-copilot/docs/test-manager-coach-transcript-contrast-2026-03-08.md`
- `/Users/assistant/.openclaw/workspace/okr-copilot/docs/test-coach-transcript-comparison-2026-03-08.md`

---

## 1) Overall quality assessment (strengths / weaknesses)

### Strengths
1. **Strong intent to preserve OKR quality discipline**
   - Coach repeatedly protects against writing vague OKRs and tries to lock objective logic before drafting.
2. **Good metric instincts when enough context is present**
   - In the baseline scenario, final KR set is structurally solid (lagging + leading + guardrail), numeric, and quarter-bounded.
3. **Decent role-appropriate framing**
   - Questions are generally managerial (business outcome, behavior change, constraints, guardrails) rather than feature/task-level.
4. **Handles scope correction without derailment**
   - Contrast transcript correctly accepts shift from mixed new+expansion to new-business-only.

### Weaknesses
1. **Over-gating causes stalled convergence**
   - Coach behaves as if one missing field invalidates all forward progress, even when partial context is enough to draft with assumptions.
2. **Repetition without synthesis**
   - Re-asks semantically identical questions instead of summarizing known inputs and narrowing the unknown.
3. **Insufficient responsiveness to user intent shift**
   - When user asks “produce usable final draft now,” coach still blocks instead of generating “best possible now + explicit assumptions.”
4. **Weak partial-credit logic**
   - User provides substantial data (targets/baselines/constraints/scope), but system does not advance stage proportionally.
5. **Poor fallback artifact quality in non-convergent path**
   - Saved draft defaults to generic objective + “ship one process improvement,” which is inconsistent with collected context.

**Overall rating:**
- **Baseline run:** 7.5/10 (late convergence, good final output)
- **Contrast run:** 4/10 (overly rigid, fails to produce usable result)
- **System readiness:** 5.5/10 (capable, but brittle under ambiguity)

---

## 2) Turn-level critique patterns

## A. Question quality
- **What works:** Questions are concise, mostly domain-relevant, and attempt to enforce outcome orientation.
- **What fails:** The coach asks open-loop questions that are too similar in intent over multiple turns.
- **Observed anti-patterns:**
  - Baseline T8/T10/T14/T16: near-verbatim “what is first value?” repeated.
  - Contrast T2/T3/T4/T5/T7/T8: recurring “main business problem?” despite adjacent answers.

**Coaching implication:** Repetition reduces trust and perceived intelligence faster than asking a slightly imperfect next-step question.

## B. Convergence behavior
- **Baseline:** Eventually converges after explicit direct answer from user.
- **Contrast:** Never converges within similar turn budget.
- **Pattern:** Stage progression is binary (complete/incomplete) instead of confidence-based.

## C. Specificity progression
- Good once unlocked (baseline final KRs are specific).
- Poor pre-unlock: system does not capitalize on “rough numbers from memory + willingness to recalibrate in first two weeks.”

## D. Coaching style
- Current style resembles **form validator** more than **coach-partner**.
- Missing moments:
  - Reflective summarization (“Here’s what I heard…”) 
  - Option framing (“If X is true, we can draft this way; if Y, then this way.”)
  - Decision support under uncertainty.

---

## 3) Loop-risk diagnosis with concrete trigger points

## Loop-risk types identified
1. **Slot-lock loop (single missing field fixation)**
   - Trigger: one required semantic field unresolved (e.g., first-value definition).
   - Manifestation: repeated same question without integrating newly provided context.
2. **Semantic repeat loop (planner-level)**
   - Trigger: planner selects same intent class repeatedly (“main problem”), with minor wording variation.
3. **User-intent override failure**
   - Trigger: user explicitly requests draft output before all fields complete.
   - Manifestation: refusal/gating instead of assumption-based draft.

## Concrete trigger points from transcripts
- **Baseline**
  - Loop onset: Turn 8 (first repeated request for first-value definition)
  - Escalation: Turns 10 and 14 (continued re-ask despite new constraints/metrics)
  - Critical failure moment: Turn 16 (user asked finalize; coach still blocks)
- **Contrast**
  - Loop onset: Turn 3 (second “main business problem” ask)
  - Sustained loop: Turns 4,5,7
  - Failure to recover: Turn 8 (explicit final-draft request rejected)

## Risk scoring
- **Likelihood:** High (if user input is fuzzy/non-linear)
- **Impact:** High (abandonment risk + low trust)
- **Detectability with instrumentation:** Medium-high (semantic similarity + unresolved slot age)

---

## 4) Improvement recommendations prioritized by impact/effort

## P0 (High impact, low-medium effort)
1. **Repetition cap with forced strategy shift**
   - Rule: max 2 asks per missing slot.
   - After cap: must do synthesis + constrained clarifier or draft-with-assumptions.
2. **“Draft now with assumptions” path (hard requirement)**
   - If user asks to finalize, generate draft with:
     - assumptions block,
     - confidence tags per KR,
     - explicit TBDs.
3. **Partial-credit stage advancement**
   - Move forward when enough evidence exists (even if 1 field is weak), instead of strict gating.
4. **Known/Inferred/Missing response footer**
   - Every blocking turn includes compact field-state map.
5. **Output salvage on save**
   - Never save generic fallback if session has concrete numbers in context; auto-hydrate draft from conversation evidence.

## P1 (High impact, medium effort)
1. **Question planner semantic de-dup**
   - Detect intent-equivalent question classes across last N turns.
2. **Uncertainty-tolerant KR templates**
   - Support “provisional baseline” language with explicit recalibration window.
3. **Adaptive questioning mode by user behavior**
   - If user gives bullet-like metrics, switch to synthesis mode, not exploratory open-ended mode.
4. **Convergence governor**
   - Target usable draft by turn budget (e.g., by turn 6 unless safety-critical missing data).

## P2 (Medium impact, medium effort)
1. **Persona tuning for coaching warmth**
   - Add acknowledgement and rationale for asks to reduce “interrogation” feel.
2. **Micro-choices for ambiguous concepts**
   - Offer 2–3 candidate definitions user can pick/edit.
3. **Reusable domain playbooks**
   - Sales, Product, CS domain-specific metric libraries to accelerate drafting.

---

## 5) Prompt/policy changes recommended

## System/policy rules to add
1. **Non-refusal drafting rule**
   - “When user requests a draft, provide best-possible draft with assumptions unless safety/policy forbids.”
2. **Loop-prevention rule**
   - “Do not ask semantically equivalent question >2 times without synthesis and alternative path.”
3. **Evidence utilization rule**
   - “Must incorporate all numeric/contextual evidence already provided before asking another discovery question.”
4. **Progress transparency rule**
   - “Blocking responses must include known/inferred/missing checklist.”
5. **Turn-budget rule**
   - “By turn 5–6, offer draft skeleton even if partial.”

## Prompt wording upgrades (example snippets)
- Replace: “What is the main business problem?”
- With: “Here’s my read: weak deal progression and stale opportunities are reducing new-logo conversion. Is that accurate? If yes, I’ll draft now; if not, rewrite this sentence.”

- Replace repeated open question with constrained options:
  - “Choose one definition so we can proceed:
    A) First dashboard published
    B) Dashboard published + teammate view
    C) Custom definition (one sentence)”

---

## 6) UX changes recommended

1. **Progress tracker (Pass 1/Pass 2 fields)**
   - Visual checklist with completion state and confidence level.
2. **One-click “Draft with assumptions” CTA**
   - Prominent action when missing fields persist.
3. **Inline “Use my rough numbers” toggle**
   - Enables provisional baselines + scheduled recalibration note.
4. **“Why I’m asking” microcopy**
   - Reduces user frustration for mandatory clarifiers.
5. **Draft quality badge before save**
   - Warn if artifact is generic or missing lagging/leading/guardrail trio.
6. **Recovery modal when loop detected**
   - Offer three options: finalize now, answer one key question, or switch to guided wizard.

---

## 7) Instrumentation/metrics additions to verify improvements

## Conversation health metrics
1. **Semantic Repetition Index (SRI)**
   - Mean cosine similarity of coach questions over rolling 4 turns.
   - Alert when same intent repeats >2 times.
2. **Unresolved Slot Age**
   - Number of turns each required field remains unresolved.
3. **Time-to-First-Usable-Draft (TTFUD)**
   - User turns until first artifact with objective + 3 measurable KRs.
4. **Draft-on-request compliance**
   - % times coach generates draft within one turn after explicit user “finalize now.”

## Artifact quality metrics
5. **KR Completeness Score**
   - Presence of baseline, target, timeframe, unit, owner (optional), guardrail coverage.
6. **Fallback Avoidance Rate**
   - % saves that avoid generic placeholder objective when numeric data exists in transcript.
7. **Specificity Score**
   - Lexical + structural rubric for measurable outcomes vs activity metrics.

## User experience metrics
8. **Frustration proxy**
   - Detection of phrases like “please finalize now,” “you’re repeating,” “just draft it.”
9. **Conversation abandonment rate**
   - Session ends without usable draft.
10. **Revision burden**
   - Average manual edits needed after generated draft.

## Suggested targets (first 4 weeks)
- Reduce no-draft sessions by **>60%**
- TTFUD median ≤ **5 user turns**
- Draft-on-request compliance ≥ **95%**
- Semantic repeat violations < **5% sessions**

---

## 8) Suggested acceptance test suite for transcript quality

## A. Core convergence tests
1. **Ambiguous-start convergence test**
   - Input: fuzzy business context, rough metrics.
   - Expected: usable 3-KR draft by ≤6 user turns.
2. **Midstream scope correction test**
   - Input: user changes scope (e.g., new business only).
   - Expected: coach acknowledges change and updates draft assumptions.
3. **Finalize-on-demand test**
   - Input: missing one required field + explicit “finalize now.”
   - Expected: draft produced with assumptions/TBD, not refusal.

## B. Loop-resilience tests
4. **Repeated-missing-slot test**
   - Input: user avoids exact answer for one slot for 3 turns.
   - Expected: after 2 asks, coach must switch to synthesis + options.
5. **Semantic dedup test**
   - Input: planner tries same intent class repeatedly.
   - Expected: dedup guard forces alternative move.

## C. Quality and structure tests
6. **KR structure validation test**
   - Expected final draft contains exactly 3 KRs tagged lagging/leading/guardrail with numbers.
7. **Guardrail presence test**
   - Expected one non-growth risk-control metric present.
8. **No-generic-save test**
   - If transcript has numeric data, saved draft cannot be placeholder objective + generic process KR.

## D. UX behavior tests
9. **Known/Inferred/Missing display test**
   - Blocking turn must include field-state summary.
10. **Progress tracker integrity test**
   - Completion states update as user provides data.

## E. Human quality eval rubric (sample)
- **Convergence:** 1–5
- **Question quality:** 1–5
- **Context utilization:** 1–5
- **Coaching tone:** 1–5
- **Draft usability:** 1–5
- Pass threshold: avg ≥4 and no dimension <3.

---

## Recommended implementation sequence
1. Ship P0 loop cap + draft-on-request + fallback salvage (fastest trust gain).
2. Add instrumentation (SRI, TTFUD, compliance).
3. Deploy P1 planner upgrades and adaptive mode.
4. Add UX progress/state surfaces.
5. Validate with acceptance suite + weekly transcript audits.

---

## Bottom line
The coach already has good OKR quality instincts, but behaves too rigidly under incomplete inputs. The highest-leverage fix is **assumption-based convergence with explicit transparency**, backed by **semantic loop guards** and **non-generic save behavior**.