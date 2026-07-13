#!/usr/bin/env bash
#
# Run comprehensive luck/skill collection in parallel by splitting configs across processes.
#
# Usage:
#   COMPREHENSIVE_GAMES=500 COMPREHENSIVE_WORKERS=15 bash tools/nn/run-comprehensive-parallel.sh
#

set -euo pipefail

GAMES="${COMPREHENSIVE_GAMES:-500}"
WORKERS="${COMPREHENSIVE_WORKERS:-8}"
OBJECTIVE="${COMPREHENSIVE_OBJECTIVE:-points}"
BASE_SEED="${COMPREHENSIVE_SEED:-9001}"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PARALLEL LUCK/SKILL COLLECTION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Games/config: $GAMES"
echo "Workers: $WORKERS"
echo "Objective: $OBJECTIVE"
echo ""

# Warp factors: 9, 12, 15, 18
FACTORS=(9 12 15 18)
PIDS=()

for FACTOR in "${FACTORS[@]}"; do
  echo "Starting worker for Warp $FACTOR..."
  
  COMPREHENSIVE_WARP_FACTOR=$FACTOR \
  COMPREHENSIVE_GAMES=$GAMES \
  COMPREHENSIVE_OBJECTIVE=$OBJECTIVE \
  COMPREHENSIVE_SEED=$BASE_SEED \
  COMPREHENSIVE_OUTPUT="tools/nn/data/luck-skill-w${FACTOR}.json" \
  npx tsx tools/nn/collect-luck-skill-single-factor.ts \
    2>&1 | tee "tools/nn/data/collect-w${FACTOR}.log" &
  
  PIDS+=($!)
  
  # Throttle to not exceed worker count
  if [ ${#PIDS[@]} -ge $WORKERS ]; then
    wait ${PIDS[0]}
    PIDS=($(jobs -p))
  fi
done

echo ""
echo "Waiting for all workers to complete..."
wait

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  MERGING RESULTS"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Merge all JSON files
npx tsx tools/nn/merge-luck-skill-results.ts

echo ""
echo "✓ Complete! Results in tools/nn/data/luck-skill-comprehensive.json"
