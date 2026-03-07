#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> verify-workflow: typecheck"
npm run typecheck

echo "==> verify-workflow: build"
npm run build

echo "==> verify-workflow: test"
npm run test

echo "==> verify-workflow: release evidence gate"
npm run release:checklist

echo "✅ verify-workflow passed"
