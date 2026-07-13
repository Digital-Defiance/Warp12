# Quick Start: Parallel Luck/Skill Collection

## Fix Tests First

```bash
cd /Volumes/Code/Warp12
yarn build:bridge
yarn test:bridge
```

Should see: **All tests passing** (249 passed)

## Run Parallel Collection

### Option 1: Simple (6 parallel workers, one per Warp factor)

```bash
COMPREHENSIVE_GAMES=500 \
COMPREHENSIVE_WORKERS=6 \
bash tools/nn/run-comprehensive-parallel.sh
```

**What it does:**
- Spawns 6 background processes (one per Warp factor: 3/6/9/12/15/18)
- Each collects all fleet sizes for that factor
- Runs in parallel, ~5-10 minutes total
- Merges results into `tools/nn/data/luck-skill-comprehensive.json`

**Output files:**
- `tools/nn/data/luck-skill-w3.json`
- `tools/nn/data/luck-skill-w6.json`
- `tools/nn/data/luck-skill-w9.json`
- `tools/nn/data/luck-skill-w12.json`
- `tools/nn/data/luck-skill-w15.json`
- `tools/nn/data/luck-skill-w18.json`
- `tools/nn/data/luck-skill-comprehensive.json` (merged)

### Option 2: More Workers (15 workers)

```bash
COMPREHENSIVE_GAMES=500 \
COMPREHENSIVE_WORKERS=15 \
bash tools/nn/run-comprehensive-parallel.sh
```

Still runs 6 factor-workers, but throttles if you add more factors later.

### Option 3: Pilot Study (fast)

```bash
COMPREHENSIVE_GAMES=100 \
COMPREHENSIVE_WORKERS=6 \
bash tools/nn/run-comprehensive-parallel.sh
```

**~2 minutes total**, good for testing.

## Monitor Progress

```bash
# Watch live progress
tail -f tools/nn/data/collect-w12.log

# Check all workers
ps aux | grep collect-luck-skill
```

## What's Still Needed

The scripts are ready but `runSelfPlayMatch` needs the update from `luck-skill-READY-TO-RUN.md`:

1. Accept `maxPip` and `collectMetrics` options
2. Pass them through to `playSelfPlayGame`  
3. Return `gameMetrics` array

**Once that's done (30 minutes), everything else works out of the box.**

## Test the Plumbing

```bash
# Test one factor (W12)
COMPREHENSIVE_WARP_FACTOR=12 \
COMPREHENSIVE_GAMES=10 \
node --loader tsx tools/nn/collect-luck-skill-single-factor.ts

# Should output tools/nn/data/luck-skill-w12.json with 7 configs (2-8p)
```

## After Collection

```bash
# Analyze
node --loader tsx tools/nn/analyze-luck-skill-stats.ts

# Generate figures
node --loader tsx tools/nn/generate-luck-skill-figures.ts

# LaTeX tables
node --loader tsx tools/nn/generate-luck-skill-tables.ts
```

(These analysis scripts don't exist yet, but the data format is designed for them)
