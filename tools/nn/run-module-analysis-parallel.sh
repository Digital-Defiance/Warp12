#!/usr/bin/env bash
#
# Comprehensive module analysis: test every Warp factor × player count × module combination.
# This quantifies skill vs luck across all configurations to guide recommendations.
#
# Usage:
#   MODULE_GAMES=500 bash tools/nn/run-module-analysis-parallel.sh
#
# Worker count defaults to (CPU cores − 2) after warp_env_load train; override with MODULE_WORKERS.
#

set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/lib/warp-env.sh"
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
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  Progress: $COMPLETED / $TOTAL_CONFIGS configs ($percent%)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}

_analysis_reap_finished() {
  local still=()
  local pid rc
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do
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
  # Bash + set -u: empty "${still[@]}" is unbound — reassign safely.
  if [ "${#still[@]}" -eq 0 ]; then
    PIDS=()
  else
    PIDS=("${still[@]}")
  fi
}

_analysis_on_signal() {
  echo "Interrupted — stopping workers..." >&2
  local pid
  for pid in ${PIDS[@]+"${PIDS[@]}"}; do
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
      # Ignore transient kill/interrupt on sleep (OOM pressure); keep throttling.
      sleep 0.2 || true
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
      sleep 0.2 || true
    fi
  done
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COMPREHENSIVE MODULE ANALYSIS"
echo "  Luck vs Skill across all configurations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Max workers: $WORKERS (default: CPU cores − 2)"
echo "Objective: $OBJECTIVE"
echo "Data dir: $DATA_DIR"
echo ""

# Module configs to test — all 12 named modules + official preset + full stress test.
# zeta (squadrons, squadronSize=2) requires an even player count >= 4 — formSquadrons()
# throws otherwise — so standalone zeta is added only when eligible. The "all" stress
# config still runs on smaller/odd fleets; the collector auto-omits Zeta there.
# Go-out: Epsilon (Drafting) is unavailable (lobby/RULES gate) — omit from the matrix.
if [ "$OBJECTIVE" = "go-out" ]; then
  MODULES=("none" "alpha" "beta" "gamma" "delta" "eta" "theta" "iota" "kappa" "lambda" "mu" "official" "all")
else
  MODULES=("none" "alpha" "beta" "gamma" "delta" "epsilon" "eta" "theta" "iota" "kappa" "lambda" "mu" "official" "all")
fi
MODULE_COUNT=$((${#MODULES[@]} + 1)) # +1 for zeta, added conditionally

CONFIGS=()

add_configs_for_warp() {
  local FACTOR=$1
  local MIN_P=$2
  local MAX_P=$3
  local P M
  for P in $(seq "$MIN_P" "$MAX_P"); do
    for M in "${MODULES[@]}"; do
      CONFIGS+=("$FACTOR:$P:$M")
    done
    if [ "$P" -ge 4 ] && [ $((P % 2)) -eq 0 ]; then
      CONFIGS+=("$FACTOR:$P:zeta")
    fi
  done
}

add_configs_for_warp 9 2 4
add_configs_for_warp 12 2 8
add_configs_for_warp 15 2 12
add_configs_for_warp 18 2 18

TOTAL_CONFIGS=${#CONFIGS[@]}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  CONFIGURATION MATRIX"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Warp factors: 4 (W9, W12, W15, W18)"
echo "Player counts:"
echo "  - W9:  3 (2-4p)"
echo "  - W12: 7 (2-8p)"
echo "  - W15: 11 (2-12p)"
echo "  - W18: 17 (2-18p)"
echo "Module configs: $MODULE_COUNT (none, alpha-mu, zeta*, official, all† — *zeta only at even p>=4; †all omits zeta when ineligible)"
echo ""
echo "Total configs: $TOTAL_CONFIGS"
echo "Total games: $((TOTAL_CONFIGS * GAMES))"
echo ""
echo "Estimated wall time (order of magnitude, ~0.5–2s/game):"
echo "  ~$(((TOTAL_CONFIGS * GAMES) / WORKERS / 60))–$(((TOTAL_CONFIGS * GAMES * 2) / WORKERS / 60)) min at $WORKERS workers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

echo "Starting workers..."
echo ""

for CONFIG in "${CONFIGS[@]}"; do
  IFS=':' read -r FACTOR PLAYERS MODULE <<< "$CONFIG"
  OUT="${DATA_DIR}/luck-skill-w${FACTOR}-p${PLAYERS}-m${MODULE}.json"

  # Resume: skip cells that already wrote a result (re-run after OOM / kill).
  if [ -s "$OUT" ] && grep -q '"games"' "$OUT" 2>/dev/null; then
    COMPLETED=$((COMPLETED + 1))
    echo "[W${FACTOR}·${PLAYERS}p·${MODULE}] skip (exists)"
    continue
  fi

  MODULE_WARP_FACTOR=$FACTOR \
  MODULE_PLAYER_COUNT=$PLAYERS \
  MODULE_CONFIG=$MODULE \
  MODULE_GAMES=$GAMES \
  MODULE_OBJECTIVE=$OBJECTIVE \
  MODULE_SEED=$BASE_SEED \
  MODULE_OUTPUT="$OUT" \
  _analysis_tsx tools/nn/collect-luck-skill-modules.ts \
    2>&1 | sed "s/^/[W${FACTOR}·${PLAYERS}p·${MODULE}] /" &

  PIDS+=($!)
  _analysis_throttle
done

echo ""
echo "Waiting for final workers to complete..."
_analysis_wait_all
trap - INT TERM

COMPLETED=$(find "$DATA_DIR" -maxdepth 1 -name 'luck-skill-w*-p*-m*.json' -type f | wc -l | tr -d ' ')

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ANALYSIS COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ "$FAILURES" -gt 0 ]; then
  echo "✗ $FAILURES / $TOTAL_CONFIGS worker(s) failed" >&2
  echo "  Completed configs: $COMPLETED / $TOTAL_CONFIGS"
  echo "  Results (partial): ${DATA_DIR}/luck-skill-w*-p*-m*.json"
  exit 1
fi

echo "✓ All $TOTAL_CONFIGS configurations processed"
echo "  Total games: $((TOTAL_CONFIGS * GAMES))"
echo ""
echo "Results: ${DATA_DIR}/luck-skill-w*-p*-m*.json"
echo ""
echo "Next steps:"
echo "  1. Analyze results: yarn exec tsx tools/nn/analyze-module-results.ts"
echo "  2. Generate recommendations for docs/calibration-log"
echo ""
