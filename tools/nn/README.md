# Class I* neural training (offline)

Python training pipeline for Warp 12 **Class I*** — Commander heuristics plus a learned residual scorer.

## Architecture

1. **Collect** — Commander self-play → JSONL trajectories (Node/jiti)
2. **Train** — PyTorch MLP → `class1-star-v1.onnx` + `class1-star-v1.json`
3. **Bench** — Class I* vs Commander win rate
4. **Ship** — artifacts in `apps/Warp12/public/models/`; app loads via ORT (WebNN → wasm → TS)

Coach/advisor path never uses the model — only `scoreWithHeuristics`.

---

# Class Ω neural training (standalone self-play)

**Class Ω ("Omega")** is a *different animal* from Class I*. Class I* is a residual
bolted onto Commander and trained to imitate Commander — which is why it converged
to a Commander clone (~parity, 98% top-1). Omega throws that out:

- **Standalone policy + value network.** No heuristic score is added; the net
  *is* the player. Policy head scores each candidate (303-dim state+action);
  value head estimates the acting seat's outcome from the state alone (195-dim).
- **Self-play from scratch.** The net drives every seat, sampling from its own
  policy for exploration. A zero-init net = uniform-random play, iteratively
  improved by playing itself.
- **Outcome is the only reward.** Actor-critic (REINFORCE with a value baseline);
  the sole supervision is win/loss (+1 / −1) for the acting seat. **There is no
  Commander in the players, the targets, or the labels — anywhere.**
- **Deliberately opaque.** Omega cannot explain its moves in heuristic terms.
  That is the trade for letting it *exceed* Commander instead of imitating it.
  The coach/advisor path is untouched and stays on the explainable heuristic
  model (and advisor-assisted matches are unrated anyway).

## Pipeline

```bash
# One iteration: self-play → train → bench sweep (2p/3p/4p)
yarn omega:pipeline

# Iterative self-play: warm-start from the current net, collect with it, retrain
yarn omega:iterate      # repeat this to climb

# Steps individually
OMEGA_GAMES=1000 yarn omega:collect
yarn omega:train                     # or omega:train:warm to continue a net
OMEGA_BENCH_GAMES=500 yarn omega:bench
```

Early iterations will look **worse** than Commander before they surpass it — that
is expected for from-scratch self-play. Gate promotion on `omega:bench` holding
above Class II *across all player counts and both objectives* (the bench prints
implied Elo per slice), not on a single 2p mode.

| Variable | Default | Purpose |
|----------|---------|---------|
| `OMEGA_GAMES` | 200 | Self-play games per collection |
| `OMEGA_PLAYERS` | 2 | Table size for collection |
| `OMEGA_OBJECTIVE` | points | `points` or `go-out` |
| `OMEGA_TEMPERATURE` | 1 | Self-play sampling temperature (exploration) |
| `OMEGA_WEIGHTS` | `apps/Warp12/public/models/omega-v1.json` | Net for collect/bench (missing = zero-init) |
| `OMEGA_POLICY_HIDDEN` | 256,256 | Policy hidden widths |
| `OMEGA_VALUE_HIDDEN` | 256,128 | Value hidden widths |
| `OMEGA_EPOCHS` | 20 | Training epochs |
| `OMEGA_VALUE_COEF` | 1.0 | Value-loss weight |
| `OMEGA_ENTROPY_COEF` | 0.01 | Policy entropy bonus (keeps exploration alive) |
| `OMEGA_BENCH_GAMES` | 200 | Games per bench slice |
| `OMEGA_BENCH_PLAYERS` | 2,3,4 | Player counts to sweep |

## Artifacts

| File | Purpose |
|------|---------|
| `omega-v1.json` | TS CPU fallback (`OmegaModelWeights`: policy + value heads) |
| `omega-policy-v1.onnx` | Policy head (input `features` [N,303] → `logit` [N,1]) |
| `omega-value-v1.onnx` | Value head (input `state` [N,195] → `value` [N,1]) |

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
