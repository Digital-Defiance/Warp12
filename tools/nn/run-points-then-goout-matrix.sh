#!/usr/bin/env bash
# Sequential full module matrices after AI teaching: points refresh, then go-out.
# Usage: nohup bash tools/nn/run-points-then-goout-matrix.sh &
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

LOG_DIR="$ROOT/tools/nn/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/module-matrix-rerun-$(date +%Y%m%d-%H%M%S).log"
ln -sfn "$(basename "$LOG")" "$LOG_DIR/module-matrix-rerun-latest.log"
exec >>"$LOG" 2>&1
echo "Log: $LOG"
# M4 Max / 64GB: default to (ncpu − 2). Override with MODULE_WORKERS.
if [ -n "${MODULE_WORKERS:-}" ]; then
  WORKERS="$MODULE_WORKERS"
else
  NCPU=$(sysctl -n hw.ncpu 2>/dev/null || nproc 2>/dev/null || echo 8)
  WORKERS=$((NCPU - 2))
  if [ "$WORKERS" -lt 1 ]; then WORKERS=1; fi
fi
GAMES="${MODULE_GAMES:-500}"

echo "=== POINTS matrix start $(date -u +%Y-%m-%dT%H:%M:%SZ) workers=$WORKERS ==="
WARP12_ANALYSIS_DATA_DIR="$ROOT/tools/nn/data/points-modules-rerun" \
  MODULE_OBJECTIVE=points MODULE_GAMES="$GAMES" MODULE_WORKERS="$WORKERS" \
  bash "$ROOT/tools/nn/run-module-analysis-parallel.sh"

echo "=== POINTS analyze $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
WARP12_ANALYSIS_DATA_DIR="$ROOT/tools/nn/data/points-modules-rerun" \
  "$ROOT/node_modules/.bin/tsx" "$ROOT/tools/nn/analyze-module-results.ts"

echo "=== GO-OUT matrix start $(date -u +%Y-%m-%dT%H:%M:%SZ) workers=$WORKERS ==="
WARP12_ANALYSIS_DATA_DIR="$ROOT/tools/nn/data/go-out-modules" \
  MODULE_OBJECTIVE=go-out MODULE_GAMES="$GAMES" MODULE_WORKERS="$WORKERS" \
  bash "$ROOT/tools/nn/run-module-analysis-parallel.sh"

echo "=== GO-OUT analyze $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
WARP12_ANALYSIS_DATA_DIR="$ROOT/tools/nn/data/go-out-modules" \
  "$ROOT/node_modules/.bin/tsx" "$ROOT/tools/nn/analyze-module-results.ts"

echo "=== ALL DONE $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
echo "Log: $LOG"
