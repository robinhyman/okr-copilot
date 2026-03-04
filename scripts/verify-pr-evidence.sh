#!/usr/bin/env bash
set -euo pipefail

EVIDENCE_FILE="${1:-${PR_EVIDENCE_FILE:-docs/qa/pr-evidence.md}}"

fail() {
  echo "[evidence][error] $1" >&2
  exit 1
}

pass() {
  echo "[evidence][ok] $1"
}

[[ -f "$EVIDENCE_FILE" ]] || fail "Evidence file not found: $EVIDENCE_FILE"

line_for_key() {
  local key="$1"
  grep -Eim1 "(^|[^A-Za-z0-9_])${key}[^A-Za-z0-9_]*:" "$EVIDENCE_FILE" || true
}

extract_value() {
  local line="$1"
  echo "$line" | sed -E 's/.*:[[:space:]]*//'
}

require_truthy() {
  local key="$1"
  local line
  line="$(line_for_key "$key")"
  [[ -n "$line" ]] || fail "Missing required field: ${key}: <value>"

  local value
  value="$(extract_value "$line")"
  if echo "$value" | grep -Eiq '^(true|yes|ok|pass|passed|✅)$'; then
    pass "$key is set ($value)"
  else
    fail "$key must be truthy (true/yes/ok/pass/✅). Found: $value"
  fi
}

require_nonempty() {
  local key="$1"
  local line
  line="$(line_for_key "$key")"
  [[ -n "$line" ]] || fail "Missing required field: ${key}: <value>"

  local value
  value="$(extract_value "$line")"
  [[ -n "${value// }" ]] || fail "$key must not be empty"
  echo "$value"
}

require_truthy "DEPLOY_OK"
require_truthy "LINUX_TARGET_OK"

E2E_VALUE="$(require_nonempty "E2E_ARTIFACTS")"
if echo "$E2E_VALUE" | grep -Eiq '(https?://|artifacts?/|docs/|\.zip|\.html|\.json|\.png|\.jpg|\.jpeg|\.webm|\.md)'; then
  pass "E2E_ARTIFACTS looks like link/path evidence"
else
  fail "E2E_ARTIFACTS must include at least one artifact link/path (url, artifacts/, or artifact file extension)."
fi

USER_SIM_VALUE="$(require_nonempty "USER_SIM_VERDICT")"
if echo "$USER_SIM_VALUE" | grep -Eiq '^(pass|fail|blocked|needs[-_ ]follow[-_ ]up|✅|❌)'; then
  pass "USER_SIM_VERDICT is present ($USER_SIM_VALUE)"
else
  fail "USER_SIM_VERDICT must be one of: PASS, FAIL, BLOCKED, NEEDS_FOLLOW_UP (or ✅/❌). Found: $USER_SIM_VALUE"
fi

echo "[evidence][ok] PR evidence is complete: $EVIDENCE_FILE"