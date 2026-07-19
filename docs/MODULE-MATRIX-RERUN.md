# Module skill/luck re-evaluation (points + go-out)

After teaching AI module play (spool candidates, abort risk, go-out forks),
re-run the 285k-class module matrix for **both** objectives and refresh the
paper’s Section 15 / module taxonomy.

## One-shot (recommended)

Runs points → analyze → go-out → analyze. Log under `tools/nn/logs/`.

```bash
# Aggressive on M4 Max 64GB (~14 workers = ncpu − 2)
MODULE_WORKERS=14 nohup bash tools/nn/run-points-then-goout-matrix.sh &
# or: MODULE_WORKERS=14 MODULE_GAMES=500 nohup bash tools/nn/run-points-then-goout-matrix.sh &
```

Run this in **Terminal.app** (not Cursor) so the farm isn’t killed with the agent shell. Resume is built in — existing cell JSON is skipped.

## Prerequisites

```bash
yarn build:engine
yarn test:engine -- module-aware-ai.spec.ts spool-strategy.spec.ts hand-exchange-ai.spec.ts
```

## Points (baseline refresh)

Keep prior JSON if you want a side-by-side; otherwise overwrite `tools/nn/data/`.

```bash
# Full points matrix (~285k games at MODULE_GAMES=500)
WARP12_ANALYSIS_DATA_DIR=tools/nn/data/points-modules-rerun \
  MODULE_OBJECTIVE=points MODULE_GAMES=500 MODULE_WORKERS=14 \
  bash tools/nn/run-module-analysis-parallel.sh

WARP12_ANALYSIS_DATA_DIR=tools/nn/data/points-modules-rerun \
  npx tsx tools/nn/analyze-module-results.ts
```

Summaries write under the data dir (`module-analysis-summary.json`, `MODULE-ANALYSIS.md`).
Optionally copy the MD into `docs/` for the paper pass.

## Go-out (first full matrix)

Epsilon is omitted automatically when `MODULE_OBJECTIVE=go-out`.

```bash
WARP12_ANALYSIS_DATA_DIR=tools/nn/data/go-out-modules \
  MODULE_OBJECTIVE=go-out MODULE_GAMES=500 MODULE_WORKERS=14 \
  bash tools/nn/run-module-analysis-parallel.sh

WARP12_ANALYSIS_DATA_DIR=tools/nn/data/go-out-modules \
  npx tsx tools/nn/analyze-module-results.ts
```

Quick smoke (100 games/config):

```bash
WARP12_ANALYSIS_DATA_DIR=tools/nn/data/go-out-modules-smoke \
  MODULE_OBJECTIVE=go-out MODULE_GAMES=100 MODULE_WORKERS=14 \
  bash tools/nn/run-module-analysis-parallel.sh
```

```bash
# Points figs 11–20 + table4
WARP12_ANALYSIS_DATA_DIR=tools/nn/data/points-modules-rerun \
  MODULE_FIGURE_OBJECTIVE=points python3 tools/nn/create-module-figures.py

# Go-out figs 21–28 + table5 (separate assets; go-out labels)
WARP12_ANALYSIS_DATA_DIR=tools/nn/data/go-out-modules \
  MODULE_FIGURE_OBJECTIVE=go-out python3 tools/nn/create-module-figures.py

# Optional: shared-ID compare/contrast only (figure29)
MODULE_FIGURE_OBJECTIVE=contrast python3 tools/nn/create-module-figures.py
```

## AI teaching shipped with this re-run

| Gap | Fix |
|---|---|
| Spool not in candidates | Re-enabled via `getSpoolOptions` |
| Abort / double mismatch | `estimateSpoolValue` abort risk (+ Fracture penalty) |
| Hot Potato pass | `hotPotatoPass` heuristic |
| Salamander Surge | `salamanderSurge` (go-out) |
| Trail Momentum | `trailMomentum` (go-out) |
| Hand Exchange | give-back heuristic + pending actor |
| Desperation Dig | candidate + mild draw preference |
| Module skill profiles | `getWarpSkillProfile(..., modules)` + local/host/collector |
