# Class I* neural training (offline)

Python training pipeline for Warp 12 **Class I*** — Commander heuristics plus a learned residual scorer.

## Architecture

1. **Collect** — Commander self-play → JSONL trajectories (Node/jiti)
2. **Train** — PyTorch MLP → `class1-star-v1.onnx` + `class1-star-v1.json`
3. **Bench** — Class I* vs Commander win rate
4. **Ship** — artifacts in `apps/Warp12/public/models/`; app loads via ORT (WebNN → wasm → TS)

Coach/advisor path never uses the model — only `scoreWithHeuristics`.

## Quick start

```bash
# 1. Python deps (once)
yarn class1-star:setup

# 2. Deep Blue pipeline (recommended — RL regret, points default)
CLASS1_STAR_GAMES=1000 CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:pipeline:deepblue

# Imitation baseline (Commander self-play):
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:deep

# Or step-by-step:
CLASS1_STAR_GAMES=1000 yarn class1-star:collect
yarn class1-star:train:deep
CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:bench
```

## Deep Blue (RL regret)

When imitation hits parity (~51% win rate, 98% top-1), switch to **regret-based RL**:

1. **Collect RL** — Class I* (current weights) plays Commander; record deviations with `commanderPick`
2. **Train** — `rl-combined` loss: win → reinforce played move; loss + flipped → target Commander pick
3. **Net** — 256×256 MLP, α=3.0, 40 epochs; warm-start from prior JSON when shapes match

```bash
CLASS1_STAR_GAMES=1000 CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:pipeline:deepblue

# Or step-by-step:
CLASS1_STAR_GAMES=1000 yarn class1-star:collect:rl
yarn class1-star:train:deepblue
CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:bench
```

Re-run `pipeline:deepblue` after each train cycle for iterative self-play (collection uses the latest weights).

## Fleet Admiral (deep search)

Determinized search with belief constraints — no new net required:

```bash
# Parallel bench on M4 Max (uses all cores minus one)
yarn fleet-admiral:bench:500

# Search + Class I* hybrid
yarn fleet-admiral:bench:hybrid

# Full pass: Deep Blue train + 500-game fleet bench
yarn fleet-admiral:pipeline
```

| Env var | Default | Purpose |
|---------|---------|---------|
| `FLEET_BENCH_GAMES` | 100 | Head-to-head games |
| `AI_BENCH_PARALLEL` | 1 | Shard games across worker threads |
| `AI_BENCH_WORKERS` | auto | Cap worker count |
| `FLEET_BENCH_CLASS1_STAR` | 0 | Use Class I* net on Fleet Admiral seat |
| `FLEET_BENCH_SEAT` | a | Fleet Admiral seat (`a` or `b` for symmetry) |
| `ADVISOR_DEEP_THINK` | 0 | 250ms time-boxed search for tactical advisor |

## Go-out objective (alternate pass)

Go-out is noisier in TEI calibration; use this when comparing against prior go-out runs:

```bash
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:go-out
```

Writes trajectories to `tools/nn/data/trajectories-go-out.jsonl` and benches with `CLASS1_STAR_OBJECTIVE=go-out`.

## Memory note

Collection streams one game at a time to disk — you do **not** need to hold all rows in RAM. Node.js still caps its own heap (~4 GB by default); `class1-star:collect` sets `--max-old-space-size=8192` because **points** games produce far more rows per game than go-out. Your system RAM (e.g. 64 GB) is not the limit — the Node heap is.

## Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `CLASS1_STAR_GAMES` | 200 | Self-play games for collection |
| `CLASS1_STAR_PROGRESS_EVERY` | 50 | Log progress every N completed games |
| `CLASS1_STAR_PLAYERS` | 2 | Table size |
| `CLASS1_STAR_OBJECTIVE` | points | `points` or `go-out` |
| `CLASS1_STAR_OUT` | `tools/nn/data/trajectories.jsonl` | Output path (default collect file) |
| `CLASS1_STAR_ALL_CANDIDATES` | 1 | Export every legal move per decision (required for ranking) |
| `CLASS1_STAR_BENCH_GAMES` | 100 | Head-to-head games |
| `CLASS1_STAR_LOSS` | combined | `combined`, `rl-combined`, `ranking`, `hinge`, `mse` |
| `CLASS1_STAR_WEIGHT_SCHEME` | outcome | `outcome`, `imitation`, `win-only`, `uniform` (not used by rl-combined) |
| `CLASS1_STAR_ALPHA` | 1.0 | Residual scale (export + combined loss) |
| `CLASS1_STAR_HIDDEN` | 128,128 | Comma-separated hidden widths (Deep Blue: 256,256) |
| `CLASS1_STAR_EPOCHS` | 20 | Training epochs |
| `CLASS1_STAR_HINGE_MARGIN` | 1.0 | Pairwise margin for `--loss hinge` |

## Training modes

| `--loss` | What it learns | Use when |
|----------|----------------|----------|
| **`combined`** (default) | Softmax on `heuristic + α·residual` | Imitation baseline |
| **`rl-combined`** | Same softmax, regret targets from RL data | **Deep Blue** — beat Commander |
| `ranking` | Residual-only softmax over candidates | Ablation / imitation baseline |
| `hinge` | Pairwise margin: chosen beats each alternative | Stronger separation signal |
| `mse` | Predict +1/−1 game outcome | Legacy — weak for move ranking |

| `--weight-scheme` | Effect |
|-------------------|--------|
| **`outcome`** (default) | 4× weight on winning-captain decisions, 0.25× on losses |
| `imitation` | 2× win / 1× loss (Commander imitation) |
| `win-only` | Train only on decisions from the game winner |
| `uniform` | Equal weight per decision |

### Why combined + outcome weighting

Earlier runs used **ranking** loss on the residual alone and **imitation** weights (2× win). That taught the net to mimic Commander picks (~74% train top-1) but bench win rate stayed ~50% in 2p go-out.

**Combined** loss optimizes the same objective as play: `argmax(heuristic + α·residual)`.

**Outcome** weighting up-weights decisions from winning captains so the net learns from outcomes, not all Commander lines equally.

### Alpha sweep

Try several α values after training — export is cheap:

```bash
CLASS1_STAR_ALPHA=0.5 yarn class1-star:train:deep
CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:bench

CLASS1_STAR_ALPHA=2.0 yarn class1-star:train:deep
CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:bench
```

Or hand-edit `alpha` in `class1-star-v1.json` and re-bench without retraining.

## Trajectory schema

Each JSONL row includes:

| Field | Purpose |
|-------|---------|
| `features` | 303-dim state + action vector |
| `heuristicScore` | Commander heuristic score (for combined loss) |
| `label` | +1 / −1 game outcome for acting captain |
| `chosen` | Whether this row is the played move |
| `decisionId` | Groups candidates for ranking |
| `commanderPick` | RL mode: candidate matches Commander heuristic pick |
| `actor` | RL mode: `class1Star` for exported decisions |
| `gameIndex` | Self-play game index |

Re-collect after upgrading the collector if `heuristicScore` is missing (combined loss falls back to 0).

## Artifacts

| File | Purpose |
|------|---------|
| `class1-star-v1.onnx` | ONNX Runtime Web (input `features` [N,303], output `residual` [N,1]) |
| `class1-star-v1.json` | TS CPU fallback (`Class1StarModelWeights`) |
| Feature dim | **303** — `CLASS1_STAR_FEATURE_DIM` in `warp12-engine` |

## App prerequisites

```bash
yarn sync:ort-wasm   # copy ORT wasm to apps/Warp12/public/ort/
```

Until trained weights exist, Class I* uses a zero residual (Commander-equivalent).

## Calibration log

After `class1-star:bench`, paste results into `docs/calibration-log.md` before shipping Class I* broadly.

Record: games collected, loss/weight/alpha, train top-1, decision flip rate, head-to-head win rate, objective, player count.
