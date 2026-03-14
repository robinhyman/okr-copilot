# Demo Evidence — Team Grouping + Chat Loop Mitigation Increment (2026-03-08)

## Scope delivered

### 1) Senior leader view grouped by team (API-sourced names + owner labels)
- Extended API payloads to include team metadata:
  - `GET /api/okrs` now hydrates each OKR with `team_name` and `owner_display_name`.
  - `GET /api/leader/rollup` now returns `teamDisplayName`, `ownerDisplayName`, `ownerLabel` per team.
- Web overview now propagates team metadata into objective metrics (`teamId`, `teamName`, `ownerLabel`).
- `OverviewSummary` now renders **team-grouped objective sections for `senior_leader` role** with explicit header labels:
  - Team name
  - Owner label
  - Team code fallback
- Manager/team-member behavior remains unchanged (flat objective list).

### 2) Coach loop mitigation
- Added loop-risk metadata fields on coaching responses (`OkrDraftMetadata`):
  - `loopDetected`, `loopStage`, `loopRiskScore`, `loopSignals`, `loopEscapePath`.
- Implemented semantic loop detection in provider pipeline:
  - theme repetition detection,
  - semantic similarity (Jaccard) vs prior assistant turn,
  - question streak signal,
  - answered-field-vs-missing-field conflict signal.
- Added convergence/escape policy:
  - medium loop risk rewrites prompt into constrained multiple-choice clarification,
  - high loop risk or prolonged question streak pivots to **assumption-based draft synthesis** and transitions to `mode='refine'`.
- Loop diagnostics are persisted in draft version metadata through existing `/api/okr-drafts/:id/chat` save path.

### 3) Suggested chips above composer
- Moved contextual suggested chips into the conversation composer area (above text entry).
- Chips source and gating:
  - top prompt suggestions (`questions`) + deterministic shortcuts,
  - deduped and capped to 3,
  - hidden while coach is thinking.
- Chip click sends through existing `sendChatTurn` pipeline and emits `suggested_chip_clicked` telemetry.

### 4) Keyboard behavior
- Replaced single-line chat input with multiline `<textarea>`.
- Implemented keyboard rules:
  - `Enter` sends (when enabled and non-empty),
  - `Shift+Enter` inserts newline,
  - `Cmd/Ctrl+Enter` parity send,
  - IME composition safe-guard prevents accidental send while composing.
- Added telemetry:
  - `chat_enter_send_used`,
  - `chat_shift_enter_newline_used`.

### 5) Instrumentation
- Added turn-level loop instrumentation events from web on response handling:
  - `coach_response_received` now includes loop metadata,
  - `coach_loop_detected`,
  - `coach_loop_escape_path`.

## Tests updated/added

- Web:
  - `OverviewSummary.test.ts` updated for senior-leader team grouping and owner labels.
  - `LeaderRollupSnapshot.test.ts` updated to assert API-provided team/owner display fields.
- API integration:
  - Added leader rollup metadata test (`teamDisplayName`, `ownerLabel`).
  - Added chat loop metadata diagnostics test (`loopRiskScore`, `loopSignals`).

## Required gates

### `npm run test -w @okr-copilot/web`
- PASS

### `npm run release:gate`
- PASS
- Includes successful typecheck, build, full workspace tests, and demo prepare checks.

### `npm run done:proof`
- PASS
- Verified API health, web overview route, and baseline domain/digest checks.

## Notes
- Existing conversational-first flow remains intact.
- Changes are additive to API contracts and backward compatible for existing consumers.
