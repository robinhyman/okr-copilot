# Decision: Conversational-Only Create Experience

Date: 2026-03-08
Decision owner: Robin (executive decision)

## Decision
Drop wizard creation mode and move to a single conversational create interface.

## Rationale
- Reduce UX ambiguity and split learning loops.
- Focus quality investment on one creation path.
- Simplify instrumentation and adoption analysis.

## Immediate policy effects
1. Conversational mode is the only supported create entry path.
2. Wizard-first and A/B routing are deprecated for product direction.
3. Existing wizard code may remain temporarily behind compatibility fallback, but is no longer product-facing.

## Implementation implications (next increment)
- Remove user-facing wizard entry points and switch affordances.
- Remove wizard-related experiment branching and fallback assumptions.
- Keep reliability/quality gates unchanged (`release:gate`, `done:proof`).
- Update docs and evidence templates to conversational-only language.

## Success criteria
- All create flows route to conversational entry.
- No user-facing references to wizard mode.
- Tests and release gate remain green.
