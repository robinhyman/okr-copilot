# OKR Copilot — MVP Loop 1 Spec

## Goal (this slice)
Ship a usable first loop that lets a user:
1. Generate an OKR draft with AI in-app
2. Edit and save OKRs in-app
3. Submit KR check-ins (value + commentary)

## Scope

### In scope
- Single workspace/user flow (no advanced roles)
- Quarter-scoped OKRs
- Objective + multiple KRs per objective
- AI-assisted initial draft generation from a short prompt
- Manual edit before save
- KR check-in entries with numeric value and text commentary

### Out of scope (for this slice)
- Multi-user collaboration, approvals, comments on others’ OKRs
- Historical trend charts, confidence scoring, forecasting
- Slack/Teams/email integrations
- Bulk import/export
- Advanced AI features (rewrite variants, coaching chat, auto-grading)
- Admin controls, audit trails, granular permissions

---

## User stories + acceptance criteria

### 1) LLM-assisted OKR draft in UI
**Story**
As a user, I can enter context and get an AI-generated OKR draft so I can start from a strong first version.

**Acceptance criteria**
- Given I am on the “Create OKRs” screen, when I submit a prompt, then I see a loading state and eventually a generated draft.
- Draft includes at least 1 objective and at least 2 KRs unless model explicitly fails.
- If generation fails, I see a recoverable error with retry.
- Generated content is editable before save; nothing is persisted automatically.

### 2) Edit/save OKRs in UI
**Story**
As a user, I can edit objective/KR text and targets, then save, so my OKRs are accurate.

**Acceptance criteria**
- I can edit objective title and KR fields inline (title, metric, start, target, current).
- Validation blocks save for required fields (objective title, KR title, KR target).
- Successful save returns persisted IDs and updated timestamps.
- After save, reloading the page shows the saved version.

### 3) KR check-in with value + commentary
**Story**
As a user, I can log a KR progress value with a short note, so progress is trackable over time.

**Acceptance criteria**
- I can submit a numeric value and commentary for a selected KR.
- Value is validated against KR metric type/range rules.
- Successful check-in updates KR current value and appends a check-in record.
- If submission fails, no partial write occurs; user can retry.

---

## API contracts (v1)

### 1) Generate OKR draft
`POST /api/v1/okr-drafts/generate`

**Request**
```json
{
  "workspaceId": "ws_123",
  "quarter": "2026-Q1",
  "prompt": "Grow B2B inbound pipeline",
  "constraints": {
    "objectiveCount": 2,
    "krPerObjective": 3
  }
}
```

**Response 200**
```json
{
  "draftId": "draft_abc",
  "objectives": [
    {
      "title": "Increase qualified inbound opportunities",
      "keyResults": [
        {
          "title": "Increase SQLs per month",
          "metric": "count",
          "startValue": 12,
          "targetValue": 25,
          "currentValue": 12
        }
      ]
    }
  ],
  "model": "gpt-5.3",
  "generatedAt": "2026-02-25T12:59:00Z"
}
```

**Errors**
- `400 INVALID_INPUT`
- `429 RATE_LIMITED`
- `502 MODEL_UNAVAILABLE`

### 2) Save OKRs
`POST /api/v1/okrs`

**Request**
```json
{
  "workspaceId": "ws_123",
  "quarter": "2026-Q1",
  "objectives": [
    {
      "title": "Increase qualified inbound opportunities",
      "keyResults": [
        {
          "title": "Increase SQLs per month",
          "metric": "count",
          "startValue": 12,
          "targetValue": 25,
          "currentValue": 12
        }
      ]
    }
  ]
}
```

**Response 201**
```json
{
  "okrSetId": "okrs_789",
  "objectives": [
    {
      "id": "obj_1",
      "title": "Increase qualified inbound opportunities",
      "keyResults": [
        {
          "id": "kr_1",
          "title": "Increase SQLs per month",
          "metric": "count",
          "startValue": 12,
          "targetValue": 25,
          "currentValue": 12
        }
      ]
    }
  ],
  "savedAt": "2026-02-25T13:05:00Z"
}
```

**Errors**
- `400 VALIDATION_ERROR`
- `409 CONFLICT` (duplicate quarter set if not allowed)
- `500 INTERNAL_ERROR`

### 3) KR check-in
`POST /api/v1/key-results/{krId}/checkins`

**Request**
```json
{
  "value": 16,
  "commentary": "New landing page + outbound sequence improved conversion.",
  "checkedAt": "2026-02-25T13:10:00Z"
}
```

**Response 201**
```json
{
  "checkinId": "ci_456",
  "krId": "kr_1",
  "value": 16,
  "commentary": "New landing page + outbound sequence improved conversion.",
  "previousValue": 12,
  "currentValue": 16,
  "checkedAt": "2026-02-25T13:10:00Z"
}
```

**Errors**
- `400 VALIDATION_ERROR`
- `404 KR_NOT_FOUND`
- `409 STALE_UPDATE`

---

## UI states

### AI draft panel
- **Idle:** prompt input + Generate button enabled
- **Loading:** spinner/skeleton, button disabled, “Generating draft…”
- **Success:** editable objective/KR form populated from draft
- **Error:** inline error banner + Retry action

### OKR editor/save
- **Idle:** editable fields, Save enabled when dirty + valid
- **Saving:** Save disabled, progress indicator
- **Success:** toast “OKRs saved”, last-saved timestamp shown
- **Error:** field-level validation messages and/or top-level API error

### KR check-in
- **Idle:** value + commentary inputs
- **Submitting:** submit disabled, loading indicator
- **Success:** check-in appears in list, KR current value updates
- **Error:** inline message; entered values preserved for retry

---

## Demo checklist (definition of done for this loop)
- [ ] Enter prompt and generate AI draft from UI
- [ ] Edit generated objective and KR values
- [ ] Save OKRs successfully and verify persistence after refresh
- [ ] Submit KR check-in with value + commentary
- [ ] Verify KR current value updates immediately
- [ ] Trigger and show one error path for each flow (generate, save, check-in)
- [ ] Basic telemetry logged for generate/save/check-in success + failure
