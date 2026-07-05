# TEI calibration log

Living record of self-play runs, optimizer passes, and preset changes.  
Goal: **honest self-improvement** — measure, tune, document, repeat.

---

## 2026-06-29 — `yarn calibrate:ai-tei-dti` (200 games / matchup)

**Points (default rules)**  
- Symmetric seating ~50/50 ✓  
- Class IV vs III: 88.0% (expected ~76%) — strong ordering  
- Class IV vs II: 91.5% (expected ~91%) — on target  
- Class III vs II: 63.0% (expected ~76%) — compressed but ordered  

**Go-out**  
- Class IV vs III: 63.0% (expected ~81%)  
- Class IV vs II: 74.5% (expected ~95%)  
- Class III vs II: **51.0%** (expected ~81%) — race variance dominates  
- 4p focus: Class II 38.5%, Class III 27.0% vs 25% random — ordering holds  

**Drop to Impulse (points sanity)**  
- All matchups complete; ordering preserved (83% / 91.5% / 59%)  

**Takeaway:** Points calibrates well. Go-out implied TEI gaps compress — percentile boards and wider reference spacing (250 vs 200) are the right product response, not tighter heuristic targets alone.

---

## 2026-06-29 — `AI_OPTIMIZER_GAMES=1000 AI_OPTIMIZER_ITERATIONS=50 yarn optimize:ai-weights`

**Duration:** ~843s (~14 min)

| Metric | Baseline | Optimized | Old target |
|--------|----------|-----------|------------|
| Loss | 0.0230 | 0.0220 | — |
| B→I | 61.4% | 61.4% | 62% |
| B→A | 69.9% | 69.9% | 78% |
| I→A | 56.3% | 56.6% | 62% |
| 4p adv/beg | 36.7% | 36.7% | ≥26% |
| 4p int/beg | 33.0% | 32.8% | ≥26% |
| 4p adv/int | 34.0% | 33.6% | ≥26% |

**Weight deltas (lieutenant only):**
- `go-out-avoid-mayhem`: 1.23 → **1.31**
- `go-out-block-leader`: 1.1 → **1.02**

**Takeaway:** Coordinate search hit a local optimum. B→A and I→A cannot reach old loss targets via lieutenant weights alone. **Actions:** apply lieutenant nudges; **recalibrate optimizer targets** to empirical bands; keep self-play + percentile as primary TEI integrity tools.

---

## Preset changes applied from this log

| Change | Rationale |
|--------|-----------|
| Lieutenant `goOutAvoidMayhem` → 1.31 | Optimizer best trial at 1000×50 |
| Lieutenant `goOutBlockLeader` → 1.02 | Optimizer best trial at 1000×50 |
| `GO_OUT_CALIBRATION_TARGETS.beginnerVsAdvanced` → 0.70 | Matches ~70% B→A at scale |
| `GO_OUT_CALIBRATION_TARGETS.intermediateVsAdvanced` → 0.56 | Matches ~56% I→A at scale |

---

## Next experiments (backlog)

- [ ] MT-Compliance scripted scenario suite (rules conformance)
- [ ] MT-Bench v1 published seeds + expected win-rate bands
- [ ] Human vs Class II pilot (external validation)
- [ ] Optimizer: allow ensign blunder/temperature as tunable dimensions (separate pass)

---

## 2026-06-30 — Class I* v1 ranking (1000-game, 2p go-out)

**Collect:** 169672 rows, 33780 decision groups  
**Train:** `--loss ranking --weight-scheme imitation` (legacy default)  
**Bench (500 games):** Class I* **48.6%** vs Commander; decision flip **17%**; commander agreement **83%**  
**Train top-1:** 74.3% (imitation of Commander picks)

**Takeaway:** Residual imitation does not beat Commander in go-out; aligns with Class III vs II ~51% compression. Class I* remains experimental.

---

## Class I* v2 experiments (Deep Q pass)

After upgrading the trainer, re-run and fill in:

```bash
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:deep
# go-out alternate:
CLASS1_STAR_GAMES=1000 yarn class1-star:pipeline:go-out
```

| Run | Loss | Weight | α | Train top-1 | Flip rate | Win rate | Notes |
|-----|------|--------|---|-------------|-----------|----------|-------|
| v2 go-out | combined | outcome | 1.5 | 65.4% | 17% | ~45% (100g) / pending 500g | combined matches inference; still parity |
| v2 points | combined | outcome | 1.5 | **97.6%** | **1.4%** | **51%** (100g) | 2.38M rows, 466k groups; near-perfect imitation → barely flips |

**Hypothesis result (2026-06-30):** Points did **not** produce a win-rate edge. More data made imitation *stronger* (98% top-1) and flips *rarer* (1.4% vs 17% go-out) — the net converged to a Commander clone, not a stronger player. Run `CLASS1_STAR_BENCH_GAMES=500` to tighten the 51% estimate, but parity is the expected reading.

---

## Class I* v3 — Deep Q (RL regret)

Imitation ceiling hit → **regret-based RL**: Class I* plays Commander, labels deviations, trains on win/loss regret targets with a larger net and higher α.

```bash
CLASS1_STAR_GAMES=1000 CLASS1_STAR_BENCH_GAMES=500 yarn class1-star:pipeline:deepblue
```

| Setting | Value |
|---------|-------|
| Collect | `collectMode: rl` — Class I* seat vs Commander |
| Loss | `rl-combined` — softmax on `heuristic + α·residual` |
| Regret | Win → reinforce played move; loss + flipped → target Commander pick |
| Net | 256×256 MLP, α=3.0, 40 epochs |
| Warm-start | prior `class1-star-v1.json` when present |

| Run | Train top-1 | Flip rate | Win rate | Notes |
|-----|-------------|-----------|----------|-------|
| v3 deepblue (1000g) | **98.7%** | **3.2%** | **49.2%** (500g) | 1.18M rows, 231k groups; warm-start 3/3; regret RL still parity |

**Hypothesis result (2026-07-01):** Full-scale regret RL did **not** break parity. Train top-1 rose to 98.7% while flip rate fell to 3.2% — the net is again converging toward Commander, not finding independent strength. Next lever: Fleet Admiral deep search (`yarn fleet-admiral:bench:500`).

---

## Fleet Admiral — deep search (2026-07)

Determinized search (depth 4, 16 worlds, belief constraints) vs Commander:

```bash
yarn fleet-admiral:bench:500
yarn fleet-admiral:bench:hybrid   # search + Class I* net
```

| Run | Depth / det | Belief | Win rate | Notes |
|-----|-------------|--------|----------|-------|
| points 2p (seat a) | 4 / 16 | yes | **64.4%** (322/500) | Fleet Admiral vs Commander; parallel bench |
| points 2p (seat b) | 4 / 16 | yes | **64.4%** (322/500) | Seat symmetry — same edge, first-seat bias negligible |
| go-out 2p | 3 / 12 | yes | **55.8%** (279/500) | Same harness, go-out preset |
| points hybrid (search + Class I*) | 4 / 16 + net | yes | **54.0%** (54/100) | Net **does not help** at α=3; search-only is stronger |

**Result (2026-07-01):** Deep determinized search **breaks parity** — especially points (64.4%). Seat-swap confirms the edge is from search depth, not first-player advantage. **Hybrid search + Class I* net regresses to ~54%** on 100 games — the residual nudges search scores toward Commander-like picks. **Ship search-only for Fleet Admiral;** keep Class I* separate or retrain net as rollout policy inside search later.

---

## Fleet Admiral — ISMCTS vs expectimax (2026-06-30)

Parallel bench on M4 Max (~1,400% CPU, `AI_BENCH_PARALLEL=1 AI_BENCH_WORKERS=15`). Heuristic rollouts default in ISMCTS.

```bash
yarn fleet-admiral:bench:500                              # ISMCTS 2p points
FLEET_BENCH_SEAT=b yarn fleet-admiral:bench:500             # seat symmetry
yarn fleet-admiral:bench:go-out-4p:500                      # ISMCTS 4p go-out
yarn jiti tools/nn/compare-fleet-search.ts                  # expectimax vs ISMCTS (30g)
```

| Run | Engine | Config | Win rate | Notes |
|-----|--------|--------|----------|-------|
| points 2p seat a | ISMCTS | 500ms / 4k iters / heuristic rollout | **48.6%** (243/500) | parity |
| points 2p seat b | ISMCTS | same | **53.6%** (268/500) | parity |
| **points 2p combined** | ISMCTS | 1000 games | **51.1%** | dead heat |
| go-out 4p seat a | ISMCTS | 300ms / 2k iters | **31.2%** sector wins (156/500) | vs 25% random baseline |
| go-out 4p Commander seat b | greedy | — | **22.6%** (113/500) | designated H2H seat |
| go-out 4p seats c+d | greedy | — | **46.2%** (231/500) | ~23% per seat |
| points 2p | expectimax | depth 4 / 16 det | **63.3%** (19/30) | compare script; smaller n |

**Result:** ISMCTS does **not** beat Commander in 2p points (Commander heuristic ≈ local maximum). Expectimax **does** (~64% at 500g). ISMCTS shows **per-seat edge in 4p go-out** (31.2% vs ~23% greedy) but bench mixes 1× search vs 3× greedy — not a clean ISMCTS vs expectimax 4p test.

**Architecture decision (2026-07):** Multi-engine routing wired in `resolveFleetAdmiralPlayLookahead()` — expectimax 2p, ISMCTS 3p+. Default `yarn fleet-admiral:bench:500` now uses expectimax in 2p points. Use `FLEET_BENCH_ENGINE=ismcts` or `compare-fleet-search.ts` for explicit A/B.

**Prior ISMCTS-only benches (pre-routing):**
