#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOG_DIR="$ROOT_DIR/artifacts/e2e-linux"
API_LOG="$LOG_DIR/api.log"
WEB_LOG="$LOG_DIR/web.log"
RUN_LOG="$LOG_DIR/run.log"

API_PID=""
WEB_PID=""

cleanup() {
  set +e
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1
  fi
  if [[ -n "${WEB_PID:-}" ]] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1
  fi
}
trap cleanup EXIT INT TERM

wait_http() {
  local name="$1"
  local url="$2"
  for _ in {1..90}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[e2e-linux] $name ready: $url" | tee -a "$RUN_LOG"
      return 0
    fi
    sleep 1
  done
  echo "[e2e-linux][error] timeout waiting for $name: $url" | tee -a "$RUN_LOG"
  exit 1
}

mkdir -p "$LOG_DIR"
: > "$RUN_LOG"

echo "[e2e-linux] starting postgres+redis" | tee -a "$RUN_LOG"
docker compose up -d postgres redis

echo "[e2e-linux] installing dependencies" | tee -a "$RUN_LOG"
npm ci >> "$RUN_LOG" 2>&1

echo "[e2e-linux] running migrations" | tee -a "$RUN_LOG"
npm run migrate >> "$RUN_LOG" 2>&1

echo "[e2e-linux] starting API" | tee -a "$RUN_LOG"
(
  cd "$ROOT_DIR/apps/api"
  TWILIO_VERIFY_SIGNATURE=false REMINDER_WORKER_ENABLED=false CORS_ORIGIN="http://host.docker.internal:5173" API_PORT=4000 npm run dev > "$API_LOG" 2>&1
) &
API_PID=$!

echo "[e2e-linux] starting web" | tee -a "$RUN_LOG"
(
  cd "$ROOT_DIR/apps/web"
  VITE_API_BASE_URL="http://host.docker.internal:4000" VITE_AUTH_STUB_TOKEN=dev-stub-token npm run dev -- --host 0.0.0.0 --port 5173 > "$WEB_LOG" 2>&1
) &
WEB_PID=$!

wait_http "api" "http://127.0.0.1:4000/health"
wait_http "web" "http://127.0.0.1:5173/checkins"

echo "[e2e-linux] running playwright tests in linux/amd64 container" | tee -a "$RUN_LOG"
docker run --rm \
  --add-host=host.docker.internal:host-gateway \
  -v "$ROOT_DIR:/work" \
  -w /work \
  mcr.microsoft.com/playwright:v1.58.2-jammy \
  bash -lc "npm ci && E2E_BASE_URL='http://host.docker.internal:5173' E2E_API_BASE_URL='http://host.docker.internal:4000' npm run test:e2e:checkins" \
  | tee -a "$RUN_LOG"

echo "[e2e-linux] complete" | tee -a "$RUN_LOG"
