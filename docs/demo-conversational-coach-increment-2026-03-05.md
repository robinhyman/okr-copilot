# Demo — Conversational OKR Coach Increment (2026-03-05)

## Increment summary
Urgent correction increment completed for conversational coach quality + wireframe alignment:
- **Modal-first create flow** now matches approved desktop intent (focused dialog workspace).
- **Coach anti-loop guard** prevents consecutive duplicate assistant prompts.
- **Missing-context prompts** are field-specific (baseline, target, constraints, timeframe), replacing generic copy.
- **Stopping criteria** now use explicit checklist logic; draft generation/refinement flow remains intact.
- Drafts library + lifecycle (save, continue later, publish) preserved.

## Scope delivered
1. **UX (desktop-focused)**
   - `Create OKR with Coach` entry action in `/okrs`.
   - Conversation workspace with iterative chat turns.
   - Draft preview/review pane (objective + KR cards) kept live with chat output.
   - Draft list panel with status/version metadata + resume.
   - Publish CTA with RBAC gating.

2. **Backend lifecycle support**
   - New draft entities: `okr_draft_sessions`, `okr_draft_versions`, `okr_draft_audit_events`.
   - Session creation, version save, chat-driven versioning, list/get, publish endpoints.
   - Version incrementing and current-version pointer updates.
   - Publish writes active OKR + key results and draft audit metadata.

3. **Deterministic fallback**
   - Existing resilient LLM provider retained.
   - Chat/draft flow remains operable with deterministic fallback when LLM key unavailable/unreachable.

4. **RBAC updates**
   - Added draft permissions:
     - Manage drafts: manager + team member in scoped team.
     - Publish draft: manager only.
   - Existing manager-only direct OKR CRUD preserved.

5. **Demo seeding**
   - Updated `scripts/seed-demo.sh` to seed:
     - multi-team OKRs/KRs/check-ins
     - draft lifecycle examples (per team)

6. **Tests**
   - API integration:
     - draft lifecycle (create session -> chat refine -> save -> publish)
     - draft RBAC (team member can draft, cannot publish)
   - Web flow utility tests:
     - coach UI state transitions
     - publish-button enablement rules

## API surface added
- `POST /api/okr-drafts/sessions`
- `GET /api/okr-drafts`
- `GET /api/okr-drafts/:id`
- `POST /api/okr-drafts/:id/chat`
- `POST /api/okr-drafts/:id/versions`
- `POST /api/okr-drafts/:id/publish`

## Correction notes (2026-03-05 urgent fix)
1. **Modal UI correction**
   - `Create OKR with Coach` now opens a true modal dialog (`role="dialog"`, `aria-modal="true"`).
   - Modal contains: conversation pane, explicit prompt-focus pane, live draft preview pane.
   - Modal actions implemented: **Save draft**, **Continue later**, **Publish when ready**.

2. **Anti-loop engine correction**
   - Deterministic guard added to avoid emitting the exact same assistant message as previous assistant turn.
   - Guard is applied in fallback and LLM-normalization paths.

3. **Prompt specificity correction**
   - Removed generic “need a bit more context” messaging.
   - Missing-context prompts now ask explicit field-specific questions (baseline/target/constraints/timeframe/outcome).

4. **Stopping criteria / refinement behavior**
   - Added required-context checklist including target intent.
   - Questions are generated only for currently missing fields.
   - Post-draft refinement keeps iterative coach behavior without resetting to generic discovery copy.

5. **RBAC and lifecycle preservation**
   - No publish permission broadening; manager-only publish remains.
   - Existing draft session/version/publish workflow unchanged.

## Validation outputs
Executed locally:
- `npm run typecheck` ✅
- `npm run build` ✅
- `npm test` ✅

Highlights:
- API tests: 28/28 pass
- Web tests: 15/15 pass
- New regression coverage added for: anti-loop prompt duplication, missing-context specificity, and modal create-flow state interaction.

## Demo readiness hard-gate evidence
### Seed execution
`./scripts/seed-demo.sh` output:
- seeded product/sales/ops teams
- objectives and KRs populated per team
- check-ins written
- draft sessions seeded

### Population verification (post-seed DB checks)
Runtime checks after seeding:
```json
{
  "okrs": 6,
  "key_results": 18,
  "kr_checkins": 12,
  "draft_sessions": 3
}
```

Interpretation:
- Non-empty OKRs/KRs/check-ins confirmed.
- Non-empty draft lifecycle data confirmed.
- Manager digest populated.
- Leader rollup populated across teams.

## Demo URL
- Web UI: `http://localhost:5173/okrs`
- API: `http://localhost:4000`

## Persona access instructions
Use persona switcher in UI:
- **Manager · Product** (`mgr_product` / `team_product`): full create/save/publish flow.
- **Team member · Sales** (`member_sales` / `team_sales`): can create/refine/save drafts; publish blocked.
- **Senior leader** (`leader_exec`): cross-team visibility for rollups and draft library.

Suggested walkthrough:
1. Open `/okrs` as manager persona.
2. Click **Create OKR with Coach**.
3. Answer coach prompts; generate first draft.
4. Save draft / mark ready.
5. Publish and verify appears in `/overview` and `/checkins` dataset.

## Known limits
- Chat transcript persistence is lightweight; currently store summary/version snapshots rather than full threaded transcript table.
- Draft review pane is read-focused (chat-led edits); no manual KR row editor in initial creation path by design.
- Publish currently creates a new OKR record (does not dedupe by objective title).

## Architecture note
Migration `006_conversational_draft_lifecycle.sql` introduces a draft-lifecycle model with version checkpoints and audit events, enabling session resume and publish traceability while keeping published OKRs immutable.
