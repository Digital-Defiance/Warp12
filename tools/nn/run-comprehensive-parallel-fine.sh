#!/usr/bin/env bash
#
# Run comprehensive luck/skill collection with FINE-GRAINED parallelism.
# Splits by both Warp factor AND fleet size for maximum worker utilization.
#
# Usage:
#   COMPREHENSIVE_GAMES=500 COMPREHENSIVE_WORKERS=15 bash tools/nn/run-comprehensive-parallel-fine.sh
#

set -euo pipefail

GAMES="${COMPREHENSIVE_GAMES:-500}"
WORKERS="${COMPREHENSIVE_WORKERS:-15}"
OBJECTIVE="${COMPREHENSIVE_OBJECTIVE:-points}"
BASE_SEED="${COMPREHENSIVE_SEED:-9001}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  FINE-GRAINED PARALLEL LUCK/SKILL COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Max workers: $WORKERS"
echo "Objective: $OBJECTIVE"
echo ""

# Generate all configurations (factor x player count)
# Warp 9/12/15/18 only, with proper fleet size limits
CONFIGS=()

# Warp 9: 2-4 players (3 configs)
for P in {2..4}; do
  CONFIGS+=("9:$P")
done

# Warp 12: 2-8 players (7 configs)
for P in {2..8}; do
  CONFIGS+=("12:$P")
done

# Warp 15: 2-12 players (11 configs)
for P in {2..12}; do
  CONFIGS+=("15:$P")
done

# Warp 18: 2-18 players (17 configs)
for P in {2..18}; do
  CONFIGS+=("18:$P")
done

TOTAL_CONFIGS=${#CONFIGS[@]}
echo "Total configurations: $TOTAL_CONFIGS (W9: 3, W12: 7, W15: 11, W18: 17)"
echo ""

PIDS=()
COMPLETED=0

for CONFIG in "${CONFIGS[@]}"; do
  IFS=':' read -r FACTOR PLAYERS <<< "$CONFIG"
  
  CONFIG_WARP_FACTOR=$FACTOR \
  CONFIG_PLAYER_COUNT=$PLAYERS \
  CONFIG_GAMES=$GAMES \
  CONFIG_OBJECTIVE=$OBJECTIVE \
  CONFIG_SEED=$BASE_SEED \
  CONFIG_OUTPUT="tools/nn/data/luck-skill-w${FACTOR}-p${PLAYERS}.json" \
  npx tsx tools/nn/collect-luck-skill-single-config.ts \
    2>&1 | sed "s/^/[W${FACTOR}·${PLAYERS}p] /" &
  
  PIDS+=($!)
  
  # Throttle to not exceed worker count
  while [ ${#PIDS[@]} -ge $WORKERS ]; do
    # Wait for any job to finish
    wait ${PIDS[0]}
    # Remove finished jobs from array
    PIDS=($(jobs -p))
    COMPLETED=$((COMPLETED + 1))
    echo ""
    echo "Progress: $COMPLETED / $TOTAL_CONFIGS configs complete"
    echo ""
  done
done

echo ""
echo "Waiting for final workers to complete..."
wait
COMPLETED=$TOTAL_CONFIGS

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MERGING RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Merge all JSON files
npx tsx tools/nn/merge-luck-skill-results.ts

echo ""
echo "✓ Complete! All $TOTAL_CONFIGS configs processed."
echo "  Results: tools/nn/data/luck-skill-comprehensive.json"
