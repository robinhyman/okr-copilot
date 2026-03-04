#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

fail() {
  echo "[linux-target][error] $1" >&2
  exit 1
}

pass() {
  echo "[linux-target] $1"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "required command not found: $1"
}

require_cmd docker
require_cmd grep
require_cmd npm

pass "checking CI workflow targets linux"
grep -q "runs-on: ubuntu-latest" .github/workflows/ci.yml || fail "CI is not pinned to ubuntu-latest"

pass "checking for macOS-only runtime references in runtime files"
if grep -RIn --exclude='validate-linux-target.sh' "\\.app/\|/Applications/\|launchctl\|brew services\|osascript" scripts apps package.json >/dev/null 2>&1; then
  fail "found macOS-specific runtime references in executable/runtime files"
fi

pass "checking container images are platform-neutral"
grep -q "postgres:16" docker-compose.yml || fail "expected postgres image not found"
grep -q "redis:7" docker-compose.yml || fail "expected redis image not found"

pass "running parity checks inside linux/amd64 Node container"
docker run --rm --platform linux/amd64 \
  -v "$ROOT_DIR:/workspace" \
  -w /workspace \
  node:22-bookworm \
  bash -lc "npm ci && npm run typecheck && npm run build"

echo "LINUX_TARGET_OK"
