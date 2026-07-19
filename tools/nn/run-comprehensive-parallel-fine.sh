#!/usr/bin/env bash
#
# Run comprehensive luck/skill collection with FINE-GRAINED parallelism.
# Splits by both Warp factor AND fleet size for maximum worker utilization.
#
# Usage:
#   COMPREHENSIVE_GAMES=500 bash tools/nn/run-comprehensive-parallel-fine.sh
#
# Worker count defaults to (CPU cores − 2) after warp_env_load train; override with COMPREHENSIVE_WORKERS.
#

set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/lib/warp-env.sh"
warp_env_load train
warp_env_cd_root

COMPREHENSIVE_GAMES="${COMPREHENSIVE_GAMES:-500}"
COMPREHENSIVE_WORKERS="${COMPREHENSIVE_WORKERS:-$(warp_env_default_workers 2)}"
OBJECTIVE="${COMPREHENSIVE_OBJECTIVE:-points}"
BASE_SEED="${COMPREHENSIVE_SEED:-9001}"

warp_env_require_positive_int COMPREHENSIVE_GAMES
warp_env_require_positive_int COMPREHENSIVE_WORKERS
WORKERS="$COMPREHENSIVE_WORKERS"
case "$OBJECTIVE" in
  points | go-out) ;;
  *)
    warp_env_die "COMPREHENSIVE_OBJECTIVE must be points or go-out (got: ${OBJECTIVE})"
    ;;
esac

GAMES="$COMPREHENSIVE_GAMES"

DATA_DIR="${WARP12_ANALYSIS_DATA_DIR:-$WARP12_ROOT/tools/nn/data}"
mkdir -p "$DATA_DIR"

_analysis_tsx() {
  local tsx_bin="${WARP12_ROOT}/node_modules/.bin/tsx"
  if [ -x "$tsx_bin" ]; then
    "$tsx_bin" "$@"
  elif command -v yarn >/dev/null 2>&1; then
    yarn exec tsx "$@"
  else
    npx tsx "$@"
  fi
}

PIDS=()
COMPLETED=0
FAILURES=0

_analysis_report_progress() {
  echo ""
  echo "Progress: $COMPLETED / $TOTAL_CONFIGS configs complete"
  echo ""
}

_analysis_reap_finished() {
  local still=()
  local pid rc
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      still+=("$pid")
      continue
    fi
    rc=0
    wait "$pid" || rc=$?
    COMPLETED=$((COMPLETED + 1))
    if [ "$rc" -ne 0 ]; then
      FAILURES=$((FAILURES + 1))
    fi
  done
  PIDS=("${still[@]}")
}

_analysis_on_signal() {
  echo "Interrupted — stopping workers..." >&2
  local pid
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  exit 130
}
trap _analysis_on_signal INT TERM

_analysis_throttle() {
  while [ "${#PIDS[@]}" -ge "$WORKERS" ]; do
    local before=$COMPLETED
    _analysis_reap_finished
    if [ "$COMPLETED" -gt "$before" ]; then
      _analysis_report_progress
    fi
    if [ "${#PIDS[@]}" -ge "$WORKERS" ]; then
      sleep 0.2
    fi
  done
}

_analysis_wait_all() {
  while [ "${#PIDS[@]}" -gt 0 ]; do
    local before=$COMPLETED
    _analysis_reap_finished
    if [ "$COMPLETED" -gt "$before" ]; then
      _analysis_report_progress
    fi
    if [ "${#PIDS[@]}" -gt 0 ]; then
      sleep 0.2
    fi
  done
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FINE-GRAINED PARALLEL LUCK/SKILL COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Max workers: $WORKERS (default: CPU cores − 2)"
echo "Objective: $OBJECTIVE"
echo "Data dir: $DATA_DIR"
echo ""

CONFIGS=()

for P in {2..4}; do
  CONFIGS+=("9:$P")
done
for P in {2..8}; do
  CONFIGS+=("12:$P")
done
for P in {2..12}; do
  CONFIGS+=("15:$P")
done
for P in {2..18}; do
  CONFIGS+=("18:$P")
done

TOTAL_CONFIGS=${#CONFIGS[@]}
echo "Total configurations: $TOTAL_CONFIGS (W9: 3, W12: 7, W15: 11, W18: 17)"
echo ""

for CONFIG in "${CONFIGS[@]}"; do
  IFS=':' read -r FACTOR PLAYERS <<< "$CONFIG"

  CONFIG_WARP_FACTOR=$FACTOR \
  CONFIG_PLAYER_COUNT=$PLAYERS \
  CONFIG_GAMES=$GAMES \
  CONFIG_OBJECTIVE=$OBJECTIVE \
  CONFIG_SEED=$BASE_SEED \
  CONFIG_OUTPUT="${DATA_DIR}/luck-skill-w${FACTOR}-p${PLAYERS}.json" \
  _analysis_tsx tools/nn/collect-luck-skill-single-config.ts \
    2>&1 | sed "s/^/[W${FACTOR}·${PLAYERS}p] /" &

  PIDS+=($!)
  _analysis_throttle
done

echo ""
echo "Waiting for final workers to complete..."
_analysis_wait_all
trap - INT TERM

if [ "$FAILURES" -gt 0 ]; then
  echo "✗ $FAILURES / $TOTAL_CONFIGS worker(s) failed" >&2
  exit 1
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MERGING RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

_analysis_tsx tools/nn/merge-luck-skill-results.ts

echo ""
echo "✓ Complete! All $TOTAL_CONFIGS configs processed."
echo "  Results: ${DATA_DIR}/luck-skill-comprehensive.json"
