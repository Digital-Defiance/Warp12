#!/usr/bin/env bash
#
# Comprehensive module analysis: test every Warp factor × player count × module combination.
# This quantifies skill vs luck across all configurations to guide recommendations.
#
# Usage:
#   MODULE_GAMES=500 MODULE_WORKERS=14 bash tools/nn/run-module-analysis-parallel.sh
#
# With M4 Max (14 cores), recommended: MODULE_WORKERS=12 (leaves 2 for OS)
#

set -euo pipefail

GAMES="${MODULE_GAMES:-500}"
WORKERS="${MODULE_WORKERS:-12}"
OBJECTIVE="${MODULE_OBJECTIVE:-points}"
BASE_SEED="${MODULE_SEED:-9001}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COMPREHENSIVE MODULE ANALYSIS"
echo "  Luck vs Skill across all configurations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Max workers: $WORKERS"
echo "Objective: $OBJECTIVE"
echo ""

# Module configs to test
MODULES=("none" "alpha" "beta" "gamma" "delta" "epsilon" "zeta" "official" "all")
MODULE_COUNT=${#MODULES[@]}

# Generate all configurations
CONFIGS=()

# Warp 9: 2-4 players (limited fleet)
for P in {2..4}; do
  for M in "${MODULES[@]}"; do
    CONFIGS+=("9:$P:$M")
  done
done

# Warp 12: 2-8 players (full range, rated factor)
for P in {2..8}; do
  for M in "${MODULES[@]}"; do
    CONFIGS+=("12:$P:$M")
  done
done

# Warp 15: 2-12 players
for P in {2..12}; do
  for M in "${MODULES[@]}"; do
    CONFIGS+=("15:$P:$M")
  done
done

# Warp 18: 2-18 players (large fleet)
for P in {2..18}; do
  for M in "${MODULES[@]}"; do
    CONFIGS+=("18:$P:$M")
  done
done

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
echo "Module configs: $MODULE_COUNT (none, alpha-zeta, official, all)"
echo ""
echo "Total configs: $TOTAL_CONFIGS"
echo "Total games: $((TOTAL_CONFIGS * GAMES))"
echo ""
echo "Estimated time (M4 Max, 12 workers):"
echo "  - Per game: ~0.5-2s depending on config"
echo "  - Total: ~$(((TOTAL_CONFIGS * GAMES) / WORKERS / 60))min - $(((TOTAL_CONFIGS * GAMES * 2) / WORKERS / 60))min"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Create data directory
mkdir -p tools/nn/data

PIDS=()
COMPLETED=0

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
  MODULE_OUTPUT="tools/nn/data/luck-skill-w${FACTOR}-p${PLAYERS}-m${MODULE}.json" \
  npx tsx tools/nn/collect-luck-skill-modules.ts \
    2>&1 | sed "s/^/[W${FACTOR}·${PLAYERS}p·${MODULE}] /" &
  
  PIDS+=($!)
  
  # Throttle to not exceed worker count (compatible with older bash)
  while [ $(jobs -r | wc -l) -ge $WORKERS ]; do
    # Wait a bit for jobs to complete
    sleep 0.5
    
    # Count completed jobs
    RUNNING=$(jobs -r | wc -l)
    NEW_COMPLETED=$((TOTAL_CONFIGS - ${#CONFIGS[@]} + $(jobs -p | wc -l) - RUNNING))
    if [ $NEW_COMPLETED -gt $COMPLETED ]; then
      COMPLETED=$NEW_COMPLETED
      PERCENT=$((COMPLETED * 100 / TOTAL_CONFIGS))
      echo ""
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo "  Progress: $COMPLETED / $TOTAL_CONFIGS configs ($PERCENT%)"
      echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      echo ""
    fi
  done
done

echo ""
echo "Waiting for final workers to complete..."
wait

COMPLETED=$TOTAL_CONFIGS

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ANALYSIS COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ All $TOTAL_CONFIGS configurations processed"
echo "  Total games: $((TOTAL_CONFIGS * GAMES))"
echo ""
echo "Results: tools/nn/data/luck-skill-w*-p*-m*.json"
echo ""
echo "Next steps:"
echo "  1. Analyze results: npx tsx tools/nn/analyze-module-results.ts"
echo "  2. Generate recommendations for docs/calibration-log"
echo ""
