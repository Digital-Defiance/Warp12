#!/usr/bin/env bash
#
# Run ONLY epsilon (drafting) module analysis — single entry point for Module Epsilon sweeps.
#
# Usage:
#   bash run-epsilon-only.sh
#   MODULE_GAMES=500 MODULE_OBJECTIVE=points bash run-epsilon-only.sh
#
# Worker count defaults to (CPU cores − 2) after warp_env_load train; override with MODULE_WORKERS.
#

set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/lib/warp-env.sh"
warp_env_load train
warp_env_cd_root

MODULE_GAMES="${MODULE_GAMES:-500}"
MODULE_WORKERS="${MODULE_WORKERS:-$(warp_env_default_workers 2)}"
OBJECTIVE="${MODULE_OBJECTIVE:-points}"
BASE_SEED="${MODULE_SEED:-9001}"

warp_env_require_positive_int MODULE_GAMES
warp_env_require_positive_int MODULE_WORKERS
WORKERS="$MODULE_WORKERS"
case "$OBJECTIVE" in
  points | go-out) ;;
  *)
    warp_env_die "MODULE_OBJECTIVE must be points or go-out (got: ${OBJECTIVE})"
    ;;
esac

GAMES="$MODULE_GAMES"

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
  local percent=0
  if [ "$TOTAL_CONFIGS" -gt 0 ]; then
    percent=$((COMPLETED * 100 / TOTAL_CONFIGS))
  fi
  echo ""
  echo "Progress: $COMPLETED / $TOTAL_CONFIGS configs ($percent%)"
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
echo "  MODULE EPSILON (DRAFTING) ANALYSIS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Max workers: $WORKERS (default: CPU cores − 2)"
echo "Objective: $OBJECTIVE"
echo "Data dir: $DATA_DIR"
echo ""

CONFIGS=()

for P in {2..4}; do
  CONFIGS+=("9:$P:epsilon")
done
for P in {2..8}; do
  CONFIGS+=("12:$P:epsilon")
done
for P in {2..12}; do
  CONFIGS+=("15:$P:epsilon")
done
for P in {2..18}; do
  CONFIGS+=("18:$P:epsilon")
done

TOTAL_CONFIGS=${#CONFIGS[@]}
TOTAL_GAMES=$((TOTAL_CONFIGS * GAMES))

echo "Total configs: $TOTAL_CONFIGS"
echo "Total games: $TOTAL_GAMES"
echo ""
echo "Estimated wall time: ~$((TOTAL_GAMES / WORKERS / 60))–$((TOTAL_GAMES * 2 / WORKERS / 60)) min at $WORKERS workers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Starting workers..."
echo ""

for CONFIG in "${CONFIGS[@]}"; do
  IFS=':' read -r FACTOR PLAYERS MODULE <<< "$CONFIG"

  MODULE_WARP_FACTOR=$FACTOR \
  MODULE_PLAYER_COUNT=$PLAYERS \
  MODULE_CONFIG=$MODULE \
  MODULE_GAMES=$GAMES \
  MODULE_OBJECTIVE=$OBJECTIVE \
  MODULE_SEED=$BASE_SEED \
  MODULE_OUTPUT="${DATA_DIR}/luck-skill-w${FACTOR}-p${PLAYERS}-m${MODULE}.json" \
  _analysis_tsx tools/nn/collect-luck-skill-modules.ts \
    2>&1 | sed "s/^/[W${FACTOR}·${PLAYERS}p·epsilon] /" &

  PIDS+=($!)
  _analysis_throttle
done

echo ""
echo "Waiting for final workers..."
_analysis_wait_all
trap - INT TERM

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAILURES" -gt 0 ]; then
  echo "✗ $FAILURES / $TOTAL_CONFIGS worker(s) failed" >&2
  echo "  Completed configs: $COMPLETED / $TOTAL_CONFIGS"
  exit 1
fi

echo "✓ All $TOTAL_CONFIGS epsilon configurations processed"
echo "  Total games: $TOTAL_GAMES"
echo ""
echo "Next: compare epsilon vs other modules"
echo "  yarn exec tsx tools/nn/analyze-module-results.ts"
echo ""
