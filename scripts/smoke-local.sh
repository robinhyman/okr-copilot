#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:5173}"

fail() {
  echo "[smoke][error] $1" >&2
  exit 1
}

check_url() {
  local url="$1"
  local expected="$2"
  local body
  body="$(curl -fsS "$url")" || fail "request failed: $url"
  if [[ -n "$expected" ]] && ! grep -q "$expected" <<<"$body"; then
    fail "unexpected response from $url (missing '$expected')"
  fi
}

check_url "$API_URL/health" '"status":"ok"'
check_url "$API_URL/modules" '"modules"'
check_url "$WEB_URL/overview" 'OKR Co-Pilot'

echo "SMOKE_OK api=$API_URL web=$WEB_URL/overview"
