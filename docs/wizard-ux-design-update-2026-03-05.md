# Wizard UX design update (2026-03-05)

## Issues found
- Wizard input and generated draft editor were visually adjacent without a strong boundary, causing users to confuse “what I type” vs “what AI generated”.
- “Focus area” and “Objective statement” overlapped semantically and led to duplicate content.
- Baseline capture was unstructured free text only, making metric extraction brittle.
- Step 6 generated drafts but did not clearly state whether it would replace current work or append.
- Post-action feedback did not consistently include source/mode context.
- Save flow had validation errors, but no lightweight “quality warning” pass before save.

## Chosen improvements
1. **Input/output separation**
   - Added explicit sections:
     - `Wizard input · draft setup`
     - `Generated output · draft editor`
   - Added visual differentiation via left-border accents for each section.

2. **Focus/objective clarity**
   - Renamed wizard field label to **Outcome focus area**.
   - Renamed objective field to **Objective direction statement** with helper copy to avoid duplication.

3. **Structured baseline (backward-compatible)**
   - Added structured baseline inputs: `value`, `unit`, `period`.
   - Kept legacy baseline text area as fallback.
   - API now accepts either:
     - `baseline` (legacy string), or
     - `baselineStructured` (value/unit/period), deriving baseline text when needed.

4. **Step 6 explicit apply mode**
   - Added `Apply generated draft` selector:
     - `Replace existing working draft`
     - `Append as new objective`
   - Append mode caps to objective limits.

5. **Post-action feedback clarity**
   - Generate/save messages now include richer status context (mode + source when available).
   - Added persistent “last action summary” in output panel.

6. **Non-blocking quality warnings before save**
   - Added heuristic warnings for:
     - vague KR titles
     - missing numeric context in title
     - generic/missing unit (`points`)
   - Warnings are visible but do **not** block save.

## Acceptance criteria
- Wizard has clear visual and heading separation between input and generated output.
- Step labels/copy reduce confusion between focus context and objective direction.
- Baseline can be provided as structured value+unit+period and still supports legacy text payloads.
- Step 6 explicitly supports replace vs append apply mode.
- Users receive clearer generate/save state feedback including source where available.
- Deterministic completion behavior remains (no loop behavior introduced).
- RBAC and existing save/check-in behaviors remain unchanged.
- Tests cover structured baseline handling and key UX quality helper behavior.
