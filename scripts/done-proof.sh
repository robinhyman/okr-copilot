#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:5173}"
AUTH_TOKEN="${AUTH_TOKEN:-dev-stub-token}"
USER_ID="${USER_ID:-mgr_product}"
TEAM_ID="${TEAM_ID:-team_product}"

pass() { echo "PASS | $1"; }
fail() { echo "FAIL | $1"; exit 1; }

resolve_url_variants() {
  local base="$1"
  echo "$base"
  if [[ "$base" == *"127.0.0.1"* ]]; then
    echo "${base/127.0.0.1/localhost}"
  elif [[ "$base" == *"localhost"* ]]; then
    echo "${base/localhost/127.0.0.1}"
  fi
}

RESOLVED_URL=""
probe_health() {
  local base_url="$1"
  local path="$2"
  local outfile="$3"
  local attempted=""

  while IFS= read -r candidate; do
    [[ -n "$candidate" ]] || continue
    local code
    code=$(curl -s -o "$outfile" -w "%{http_code}" "$candidate$path" || true)
    attempted+="${candidate}${path}=>${code};"
    if [[ "$code" == "200" ]]; then
      RESOLVED_URL="$candidate"
      return 0
    fi
  done < <(resolve_url_variants "$base_url")

  echo "${attempted%\;}"
  return 1
}

if probe_health "$API_URL" "/health" "/tmp/done_api.json"; then
  resolved_api_url="$RESOLVED_URL"
  pass "api_health status=200 url=$resolved_api_url/health"
else
  fail "api_health status!=200 attempts=$(probe_health "$API_URL" "/health" "/tmp/done_api.json" || true)"
fi

if probe_health "$WEB_URL" "/overview" "/tmp/done_web.html"; then
  resolved_web_url="$RESOLVED_URL"
  pass "web_overview status=200 url=$resolved_web_url/overview"
else
  fail "web_overview status!=200 attempts=$(probe_health "$WEB_URL" "/overview" "/tmp/done_web.html" || true)"
fi

okrs_count=$(curl -s "$resolved_api_url/api/okrs" \
  -H "x-auth-stub-token: $AUTH_TOKEN" \
  -H "x-auth-user-id: $USER_ID" \
  -H "x-auth-team-id: $TEAM_ID" | jq '.okrs | length')
[[ "${okrs_count:-0}" -gt 0 ]] || fail "domain_data.okrs count=${okrs_count:-0}"
pass "domain_data.okrs count=$okrs_count"

digest_count=$(curl -s "$resolved_api_url/api/manager/digest" \
  -H "x-auth-stub-token: $AUTH_TOKEN" \
  -H "x-auth-user-id: $USER_ID" \
  -H "x-auth-team-id: $TEAM_ID" | jq '.digest.items | length')
[[ "${digest_count:-0}" -gt 0 ]] || fail "manager_digest count=${digest_count:-0}"
pass "manager_digest count=$digest_count"

echo "DONE_PROOF: PASS"
