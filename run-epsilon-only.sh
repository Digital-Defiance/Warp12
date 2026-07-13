#!/usr/bin/env bash
#
# Run ONLY epsilon (drafting) module analysis to get real data
#
# Usage:
#   bash run-epsilon-only.sh
#

set -euo pipefail

GAMES=500
WORKERS=12
OBJECTIVE="points"
BASE_SEED=9001

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MODULE EPSILON (DRAFTING) ANALYSIS"
echo "  Re-running with smart AI drafting"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Max workers: $WORKERS"
echo "Objective: $OBJECTIVE"
echo ""

# Generate epsilon-only configurations
CONFIGS=()

# Warp 9: 2-4 players
for P in {2..4}; do
  CONFIGS+=("9:$P:epsilon")
done

# Warp 12: 2-8 players
for P in {2..8}; do
  CONFIGS+=("12:$P:epsilon")
done

# Warp 15: 2-12 players
for P in {2..12}; do
  CONFIGS+=("15:$P:epsilon")
done

# Warp 18: 2-18 players
for P in {2..18}; do
  CONFIGS+=("18:$P:epsilon")
done

TOTAL_CONFIGS=${#CONFIGS[@]}
TOTAL_GAMES=$((TOTAL_CONFIGS * GAMES))

echo "Total configs: $TOTAL_CONFIGS"
echo "Total games: $TOTAL_GAMES"
echo ""
echo "Estimated time: $((TOTAL_GAMES / WORKERS / 60))-$((TOTAL_GAMES * 2 / WORKERS / 60)) minutes"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

mkdir -p tools/nn/data

COMPLETED=0

echo "Starting workers..."
echo ""

for CONFIG in "${CONFIGS[@]}"; do
  IFS=':' read -r FACTOR PLAYERS MODULE <<< "$CONFIG"
  
  # Launch in background
  MODULE_WARP_FACTOR=$FACTOR \
  MODULE_PLAYER_COUNT=$PLAYERS \
  MODULE_CONFIG=$MODULE \
  MODULE_GAMES=$GAMES \
  MODULE_OBJECTIVE=$OBJECTIVE \
  MODULE_SEED=$BASE_SEED \
  MODULE_OUTPUT="tools/nn/data/luck-skill-w${FACTOR}-p${PLAYERS}-m${MODULE}.json" \
  npx tsx tools/nn/collect-luck-skill-modules.ts \
    2>&1 | sed "s/^/[W${FACTOR}·${PLAYERS}p·epsilon] /" &
  
  # Throttle workers
  while [ $(jobs -r | wc -l) -ge $WORKERS ]; do
    sleep 0.5
    
    RUNNING=$(jobs -r | wc -l)
    NEW_COMPLETED=$((TOTAL_CONFIGS - RUNNING))
    if [ $NEW_COMPLETED -gt $COMPLETED ]; then
      COMPLETED=$NEW_COMPLETED
      PERCENT=$((COMPLETED * 100 / TOTAL_CONFIGS))
      echo ""
      echo "Progress: $COMPLETED / $TOTAL_CONFIGS configs ($PERCENT%)"
      echo ""
    fi
  done
done

echo ""
echo "Waiting for final workers..."
wait

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  COMPLETE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✓ All $TOTAL_CONFIGS epsilon configurations processed"
echo "  Total games: $TOTAL_GAMES"
echo ""
echo "Next: Run full analysis to compare epsilon vs other modules"
echo "  npx tsx tools/nn/analyze-module-results.ts"
echo ""
