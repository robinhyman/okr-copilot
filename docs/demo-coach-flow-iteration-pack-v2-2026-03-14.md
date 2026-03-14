# Coach flow iteration pack v2 — 2026-03-14

Branch: `feat/overview-okr-visual-hierarchy-v2`
Mission: improve end-to-end coaching interaction quality for first-time OKR users with minimal deterministic intrusion.

## Iteration 1
1) **Hypothesis**  
Short, non-duplicative suggestion chips reduce blank-page friction for first-time users.

2) **Changes shipped**  
- Added `apps/web/src/lib/coachPrompts.ts` to sanitize prompt chips into concise shortcuts (max 5 words, max 3 chips, deduped, no assistant-message duplication).
- Added UI rendering for chips in coach modal (`App.tsx`) with click-to-fill/send behavior (no auto-send).
- Added `apps/web/src/lib/coachPrompts.test.ts`.

3) **Test scenarios used (realistic)**  
- New product manager with incomplete context (asks vague opening).  
- Sales manager giving partial constraints then pausing.

4) **Validation results (tests/checks)**  
- `npm run test -w @okr-copilot/web` ✅

5) **Retro: worked / didn’t / changes adopted**  
- Worked: chip sanitation caught long prose and duplication.  
- Didn’t: first pass allowed one long sentence-like chip.  
- Adopted: added pronoun-led phrase filter for chip quality.

6) **Risk + rollback note**  
- Risk: overly aggressive filtering could hide useful prompt options.  
- Rollback: remove chip sanitation import + render block in `App.tsx`.

## Iteration 2
1) **Hypothesis**  
Detecting novice first-turn language and switching to guided shortcut prompts reduces cognitive load without forcing deterministic mid-flow control.

2) **Changes shipped**  
- Added novice detection + guided entry behavior in deterministic provider (`okr-draft-provider.ts`).
- Added concise missing-field shortcut generation.
- Added integration coverage: `novice first-turn prompt returns guided shortcut chips`.

3) **Test scenarios used (realistic)**  
- Operations lead: “I am new to OKRs and not sure where to start.”  
- Product lead: gives broad goal but no baseline/target/timeframe.

4) **Validation results (tests/checks)**  
- `npm run test -w @okr-copilot/api -- src/tests/okrs.integration.test.ts` ✅

5) **Retro: worked / didn’t / changes adopted**  
- Worked: user gets one focused question + concise shortcuts.  
- Didn’t: metadata reason can be overwritten during fallback stack.  
- Adopted: test expectation broadened to stable fallback reasons while preserving behavior checks.

6) **Risk + rollback note**  
- Risk: false-positive novice detection on experienced users using similar phrasing.  
- Rollback: remove `isNoviceFirstTurn` branch in deterministic `continueConversation`.

## Iteration 3
1) **Hypothesis**  
Assumption-based draft fallback should still produce cleaner, KR-format-compliant, inspectable drafts for novices requesting “draft now”.

2) **Changes shipped**  
- Refined assumption draft KR generation to clearer measurable format: increase/increase/reduce patterns with explicit from→to numeric values.
- Reduced awkward prefixed KR labels (“Lagging:”, “Leading:”, etc.) to cleaner user-facing titles.

3) **Test scenarios used (realistic)**  
- Sales manager asks to finalize quickly with partial context.
- Product manager asks for immediate draft with baseline only.

4) **Validation results (tests/checks)**  
- API integration suite re-run (same command) ✅

5) **Retro: worked / didn’t / changes adopted**  
- Worked: fallback draft reads cleaner and is easier to edit in next turn.  
- Didn’t: guardrail semantics can still be generic when domain signal is weak.  
- Adopted: keep boundary-first approach; no heavy domain classifier added.

6) **Risk + rollback note**  
- Risk: synthetic assumptions can feel generic in niche domains.  
- Rollback: revert `buildDraftWithAssumptions` block to previous generation logic.

## Iteration 4
1) **Hypothesis**  
Codifying scenario diversity + mandatory retro steps in operating docs will prevent quality regressions in future coach iterations.

2) **Changes shipped**  
- Added this iteration pack as durable evidence.
- Updated operating system doc with explicit coaching iteration process guardrails.
- Reseeded local demo data to keep inspectable readiness.

3) **Test scenarios used (realistic)**  
- Product, Sales, Ops novice starts with varying specificity and quick-draft preference.

4) **Validation results (tests/checks)**  
- Web tests ✅
- API integration tests ✅
- Health endpoint ✅
- Demo seed presence verified via API counts ✅

5) **Retro: worked / didn’t / changes adopted**  
- Worked: iterative + retrospective loop kept behavior quality moving without architectural churn.  
- Didn’t: full API integration run is long; iteration velocity impacted.  
- Adopted: keep targeted checks in-loop + full integration at checkpoint.

6) **Risk + rollback note**  
- Risk: added process text could drift from practice.  
- Rollback: remove added section in `docs/development-operating-system.md` if process is superseded.

---

## Consolidated summary (all 4 iterations)
- Added concise suggestion-chip UX that uses short user-input shortcuts only.
- Added novice first-turn guidance path in deterministic fallback.
- Improved assumption-based draft readability and KR measurability shape.
- Added tests covering chip quality and novice guided entry.
- Preserved boundary-first deterministic posture (no heavy mid-conversation policy engine).

## User-facing coaching behavior changes
- First-time users now get cleaner, lower-cognitive-load prompting.
- Chips appear as short actionable shortcuts (e.g., “Share baseline”, “Draft now”), not duplicated coach questions.
- When context is incomplete but user wants momentum, draft fallback is clearer and easier to refine.
- Loop-escape still works, with concise guidance and assumption-based drafting when needed.

## Demo readiness
- Local demo web URL: `http://127.0.0.1:5173/overview`
- Local health URL: `http://127.0.0.1:4000/health`
- Seed status: confirmed present (team_product returns non-empty OKRs + drafts).
