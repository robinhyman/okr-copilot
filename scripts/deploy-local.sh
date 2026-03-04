#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.local-run"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"

LOCAL_IP="${LOCAL_IP:-$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo 127.0.0.1)}"
WEB_PORT="${WEB_PORT:-5173}"
API_PORT="${API_PORT:-4000}"

API_PID=""
WEB_PID=""

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[deploy][error] required command not found: $1" >&2
    exit 1
  }
}

cleanup() {
  set +e
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1
  fi
  if [[ -n "${WEB_PID:-}" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1
  fi
}

wait_http() {
  local name="$1"
  local url="$2"
  local attempts="${3:-60}"
  local delay="${4:-1}"

  for ((i = 1; i <= attempts; i++)); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[deploy] $name is ready: $url"
      return 0
    fi
    sleep "$delay"
  done

  echo "[deploy][error] timeout waiting for $name: $url" >&2
  return 1
}

wait_docker_service() {
  local name="$1"
  local cmd="$2"
  local attempts="${3:-30}"

  for ((i = 1; i <= attempts; i++)); do
    if eval "$cmd" >/dev/null 2>&1; then
      echo "[deploy] $name is healthy"
      return 0
    fi
    sleep 1
  done

  echo "[deploy][error] $name health check failed" >&2
  return 1
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
mkdir -p "$LOG_DIR"

require_cmd node
require_cmd npm
require_cmd docker
require_cmd curl

if [[ ! -f "$ROOT_DIR/.env" ]]; then
  cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
  echo "[deploy] created .env from .env.example"
fi

echo "[deploy] starting local dependencies (postgres + redis)"
docker compose up -d postgres redis

wait_docker_service "postgres" "docker compose exec -T postgres pg_isready -U okr -d okr_copilot"
wait_docker_service "redis" "docker compose exec -T redis redis-cli ping | grep -q PONG"

echo "[deploy] installing dependencies"
npm ci

echo "[deploy] running migrations"
npm run migrate

echo "[deploy] starting API (logs: $API_LOG)"
(
  cd "$ROOT_DIR/apps/api"
  TWILIO_VERIFY_SIGNATURE=false REMINDER_WORKER_ENABLED=false CORS_ORIGIN="http://${LOCAL_IP}:${WEB_PORT}" API_PORT="$API_PORT" npm run dev >"$API_LOG" 2>&1
) &
API_PID=$!

echo "[deploy] starting web (logs: $WEB_LOG)"
(
  cd "$ROOT_DIR/apps/web"
  VITE_API_BASE_URL="http://${LOCAL_IP}:${API_PORT}" VITE_AUTH_STUB_TOKEN=dev-stub-token npm run dev -- --host 0.0.0.0 --port "$WEB_PORT" >"$WEB_LOG" 2>&1
) &
WEB_PID=$!

wait_http "api" "http://127.0.0.1:${API_PORT}/health" 90 1
wait_http "web" "http://127.0.0.1:${WEB_PORT}/overview" 90 1

"$ROOT_DIR/scripts/smoke-local.sh"

echo ""
echo "DEPLOY_OK"
echo "Demo URL (this Mac): http://127.0.0.1:${WEB_PORT}/overview"
echo "Demo URL (Wi-Fi):   http://${LOCAL_IP}:${WEB_PORT}/overview"
echo "API URL:            http://${LOCAL_IP}:${API_PORT}/health"
echo "Logs:               $API_LOG and $WEB_LOG"
echo "Press Ctrl+C to stop app processes (postgres/redis remain running)."

while true; do
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "[deploy][error] api process exited unexpectedly" >&2
    exit 1
  fi
  if ! kill -0 "$WEB_PID" >/dev/null 2>&1; then
    echo "[deploy][error] web process exited unexpectedly" >&2
    exit 1
  fi
  sleep 2
done
