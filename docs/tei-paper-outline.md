# TEI, Self-Play Calibration, and Dual-Objective AI for Mexican Train

**Working title (conference):** *Self-Play Calibration of Heuristic Agents for Mexican Train Under Competing Objectives*

**Working title (white paper):** *Designing TEI: Skill Rating and AI Tiers for Warp 12 / Mexican Train*

**Status:** Outline + draft notes — not submission-ready.  

---

## Abstract (draft)

Mexican Train dominoes is commonly played under two incompatible victory conditions: **points** (lowest pip total when the round ends) and **go-out** (first player to empty their hand). We describe Warp 12’s **Tactical Effectiveness Index (TEI)** — a dual-track Elo-style rating anchored to fixed AI reference tiers — and the **self-play calibration pipeline** used to validate Class IV–II AI officers against those bands. Agents combine interpretable heuristics, optional determinized lookahead, and a rules-faithful engine (Distress Beacons, Red Alert, Neutral Zone, modules, house rules). Empirical calibration shows that **skill ordering is stable and aligns with reference TEI spacing under points**, while **go-out compresses implied skill gaps** due to race variance — especially in heads-up Class III vs Class II matchups and at higher table sizes. We argue for **percentile-augmented leaderboards**, **objective-specific search depth**, and **runtime house-rule gating** instead of per-variant weight matrices. We also report results from **Class I\***, an experimental hybrid officer, and a **multi-engine Fleet Admiral** stack. Large-scale benches show that 2-player points ISMCTS flatlines at parity (~51%), motivating the mapping of specific search backends to the right lobby settings. Finally, we report on **Class Ω**, a standalone self-play neural policy that **ships as Class II**: it reaches ~parity with legacy Commander in heads-up, pulls ahead in large fleets, and forces a lesson about TEI — **fleet-mean fair-share must not be translated naively into REF_TEI** when most rated solo play is 2–4 captains.  

---

## 1. Introduction

### 1.1 Motivation
- Mexican Train is widely played but under-studied in game AI literature.  
- Two win conditions create two different strategic games on the same table.  
- Online play needs interpretable skill measurement and fair AI opponents.  
- Coaching/advisor tools must not contaminate competitive ratings.  

### 1.2 Contributions
1. **Dual-track TEI** — independent points and go-out ratings with fixed reference AI bands.  
2. **Engine-faithful heuristic agents** — legal moves, modules, and house rules from the same code path as human play.  
3. **Self-play calibration methodology** — tier-vs-tier matrix + multi-player focus matchups + optional coordinate-search weight tuning.  
4. **Empirical comparison of objectives** — points calibrates cleanly; go-out is high-variance.  
5. **Product constraints as design** — advisor disqualification, baked-in lookahead tiers, percentile boards.  
6. **Class I\* residual learning (experimental)** — hybrid heuristic + MLP; documented imitation ceiling, points clone, and Deep Q regret pass.  
7. **Multi-engine Fleet Admiral** — expectimax for 2p points, ISMCTS for 3p+ go-out; Commander heuristics for advisor only.  
8. **Class Ω as rated Class II** — Pure self-play neural policy replaces heuristic Commander under the same σ=`commander` TEI key; Ω+ (search) stays unrated exhibition; TEI anchors tempered for typical solo table sizes.
9. **Fair-share → REF_TEI hazard** — Fleet-weighted Ω vs Commander fair-share (points ~1.38×, go-out ~1.14×) overstates heads-up strength; naive Elo translation produced anchors that would deflate the ladder.

### 1.3 Warp 12 terminology map
| Player-facing | Internal / engine |
|---------------|-------------------|
| Captain (seat) | `PlayerId` |
| TEI | Elo-style rating displayed to humans |
| Tactical Class IV–II | `ensign` / `lieutenant` / `commander` — **Class II = Ω** (neural, greedy) |
| Class I* (experimental) | Heuristic + search backend + optional learned residual — research only |
| Class Ω / Ω+ | Shipped as **Class II** (Ω greedy, rated); Ω+ = extended search (unrated exhibition) |
| Fleet Admiral (bench) | Deep-search opponent preset — not a TEI tier |
| Class I (human) | Prestige band on leaderboard (TEI ≥ 1450) — not an AI opponent tier |

---

## 2. Related work

### 2.1 Domino and tile games
- Limited prior AI work vs chess, Go, poker.
- Mexican Train specifics: doubles, public trains, draw pile, multi-player.

### 2.2 Game AI paradigms
- Heuristic policies (DoubleTwelve lineage).
- MCTS / ISMCTS for imperfect information.
- CFR and poker-style equilibrium methods.
- Deep RL self-play (AlphaZero family) — cost vs interpretability.

### 2.3 Skill rating in games
- Elo, Glicko, TrueSkill.
- Rating human vs fixed bots (Lichess bot bands, etc.).
- Separating assisted vs unassisted play.

### 2.4 Gap we fill
- Dual objective, same rules engine.
- Shippable heuristic stack with published calibration numbers.
- Open engine (`warp12-engine`) as reproducibility artifact.

---

## 3. Game model

### 3.1 Rules engine
- Immutable state transitions; pure `applyAction`.
- Warp Trails, Neutral Zone, Distress Beacon, Red Alert, Subspace Fracture.
- Optional modules: Q-Continuum, Salamander Penalty.

### 3.2 House rules as runtime constraints
- Deluxe toggles (`requireOwnTrailFirst`, `neutralZoneAfterAllTrails`, …) → legal-move graph.
- Drop to Impulse → announce/catch/penalty phase.
- All Stop ceremony → post-win flags only (no manual phase in Warp 12 default).

### 3.3 Information structure
- **Public:** charted tiles, hand counts, pile size, beacons, alerts.
- **Hidden:** opponent coordinates, draw order.
- Implication: no chess-like “solution”; belief-state reasoning required for superhuman play.

### 3.4 Two objectives as two games

| Dimension | Points | Go-out |
|-----------|---------|--------|
| Win condition | Lowest pips at round end | First empty hand |
| Horizon | Multi-round campaign (1–13) | Often single-round race |
| Core skill | Pip shedding, blocking, flexibility | Tempo, connectivity, mayhem |
| Variance | Lower | Higher |
| Search benefit | Modest at 2p (greedy near-optimal); **expectimax depth 4** extracts ~64% edge | Helpful at 2p expectimax (~56%); **ISMCTS ~31% at 4p** vs ~23% per greedy seat |
| Reference TEI spacing | 200 pts / tier | 250 pts / tier |

---

## 4. Agent architecture

### 4.1 Policy stack
- Candidate generation from legal moves + special actions.
- Weighted heuristic scoring + temperature + blunder rate.
- Optional determinized lookahead: sample hidden hands consistent with counts → forward simulate in engine.

### 4.2 Skill presets (Class IV–II)
- **Points presets:** pip dump, trail pressure, Red Alert safety, Q timing.
- **Go-out presets:** sprint heuristics (`goOutWin`, `goOutFeasibility`, block leader, avoid mayhem, …).
- Separate `goOutTuning` thresholds per tier.

### 4.3 Lookahead policy (product decision)
- Lookahead **baked into tier**, not user-toggle — keeps TEI comparable across clients.
- Class II go-out: depth 2 at **2 players only**; greedy at 3+.
- Class II points: greedy at all sizes — **Commander is a local maximum in 2p points** (ISMCTS ~51% at 1,000 games; see §4.6).
- **Class I\* (experimental):** multi-engine backend by player count and objective (§4.6).

### 4.4 Tactical advisor
- Class II profile, blunder rate 0, lookahead on.
- Explainability: `explainWarpAiAction`, turn-resolution hints.
- **Unassisted-only TEI** — advisor use tracked separately.
- **Never uses the neural net** — heuristics only, by design.

### 4.5 Class I* — heuristic + search + optional residual (experimental)

Class I* is our first step toward Phase 2 (learned policy) while keeping the shipped coach path interpretable.

#### Architecture
```
final_score(action) = heuristic_score(action) + α · residual_θ(features)
pick = argmax final_score   (+ temperature / blunder from Class II profile)
```

- **Play path:** Class II Commander heuristics plus a small MLP residual (303-dim features → scalar).
- **Coach path:** unchanged — `scoreWithHeuristics` + `explainWarpAiAction` only.
- **Inference:** ONNX Runtime Web (WebNN → wasm → TS CPU fallback) in the browser; sync JSON weights for tests and bench.

#### Feature vector (303 dims)
Public observation (objective, hand counts, pile, race phase, tile masks) plus action encoding (kind, tile, route). Same bytes in Node training, browser inference, and engine tests.

#### Offline training pipeline
1. **Collect (imitation)** — Commander self-play; export all legal candidates per decision with win/loss labels and heuristic scores.
2. **Collect (Deep Q / RL)** — Class I* (current weights) vs Commander; label deviations with `commanderPick` for regret training.
3. **Train** — PyTorch MLP → `class1-star-v1.onnx` + JSON weights.
4. **Bench** — head-to-head Class I* vs Commander; measure win rate and decision flip rate.

```bash
yarn class1-star:pipeline:deep        # imitation baseline (points default)
yarn class1-star:pipeline:go-out      # go-out alternate
yarn class1-star:pipeline:deepblue    # RL regret pass (recommended for strength)
```

| Loss | What it optimizes | Notes |
|------|-------------------|-------|
| **combined** (default) | Softmax on `heuristic + α·residual` | Matches inference; imitation baseline |
| **rl-combined** | Same softmax, **regret targets** from RL data | **Deep Q pass** — win → reinforce played move; loss + flipped → target Commander |
| ranking | Residual-only softmax | Ablation |
| hinge | Pairwise margin vs alternatives | Stronger separation |
| mse | Predict ±1 game outcome | Legacy — constant residual per turn |

| Weight scheme | Effect |
|---------------|--------|
| **outcome** (default) | 4× winning-captain decisions, 0.25× losses |
| imitation | 2× win / 1× loss (Commander mimic) |
| win-only | Train only on winner’s decisions |

**Deep Q pass (v3):** 256×256 hidden MLP, α=3.0, 40 epochs, warm-start from prior JSON when layer shapes match. Re-run `pipeline:deepblue` after each train cycle for iterative self-play (collection uses latest weights).

#### What we learned (2026-06-30 through 2026-07-01)

**Go-out, 2p, 1000-game collect, 500-game bench vs Commander:**

| Run | Train loss | Train top-1 | Flip rate | Win rate |
|-----|------------|-------------|-----------|----------|
| v1 ranking + imitation | ranking | 74.3% | 17% | **48.6%** |
| v2 combined + outcome, α=1.5 | combined | 65.4% | 17% | ~45% (100-game bench) |

**Points, 2p, 1000-game collect (imitation):**

| Run | Train loss | Train top-1 | Flip rate | Win rate |
|-----|------------|-------------|-----------|----------|
| v2 combined + outcome, α=1.5 | combined | **97.6%** | **1.4%** | **51%** (100g) |

**Deep Q (RL regret), points, 256×256, α=3.0:**

| Run | Train loss | Train top-1 | Flip rate | Win rate |
|-----|------------|-------------|-----------|----------|
| v3 rl-combined (1000g train) | rl-combined | **98.7%** | **3.2%** | **49.2%** (500g) | regret RL still parity |

**Fleet Admiral — expectimax (determinized depth search):**

| Run | Engine | Config | Win rate | Notes |
|-----|--------|--------|----------|-------|
| points 2p | expectimax | depth 4 / 16 det | **64.4%** (500g, seats a & b) | **first win vs Class II** |
| go-out 2p | expectimax | depth 3 / 12 det | **55.8%** (500g) | above parity |
| points hybrid | expectimax + Class I* net | depth 4 / 16 + net | **54.0%** (100g) | net hurts vs search-only |

**Fleet Admiral — ISMCTS (2026-06-30, heuristic rollouts, parallel bench):**

| Run | Engine | Config | Win rate | Notes |
|-----|--------|--------|----------|-------|
| points 2p seat a | ISMCTS | 500ms / 4k iters / depth-24 rollout | **48.6%** (243/500) | parity |
| points 2p seat b | ISMCTS | same | **53.6%** (268/500) | parity |
| **points 2p combined** | ISMCTS | seats a + b | **51.1%** (511/1000) | **statistical dead heat** |
| go-out 4p seat a | ISMCTS | 300ms / 2k iters; 1× search vs 3× greedy Commander | **31.2%** sector wins (156/500) | vs ~25% random baseline |
| go-out 4p Commander seat b | greedy | — | **22.6%** (113/500) | designated head-to-head seat |
| go-out 4p other Commander seats | greedy | c + d combined | **46.2%** (231/500) | ~23% per seat |

**Interpretation:**
- **Imitation ceiling:** Go-out flips ~17% of decisions but **does not convert to wins**. Points imitation reaches **98% top-1** with **1.4% flip** — a Commander clone, not a stronger player.
- **Regret pass:** RL + `rl-combined` at 1000 games → **49.2%**, 3.2% flip — still parity.
- **Expectimax (2p):** determinized depth 4 (points) → **64.4%** vs Commander at 500 games; go-out **55.8%**. **Explicit tree search breaks the parity wall** that MLP imitation/regret and ISMCTS could not in 2p points.
- **ISMCTS (2p points):** **51.1% combined over 1,000 games** — Monte Carlo rollouts (even heuristic) do not beat a greedy Commander in a tight pip-dump race. This is evidence that **Commander heuristics are strong**, not that knobs are missing.
- **ISMCTS (4p go-out):** **31.2%** sector win rate vs **~22–23%** per greedy Commander seat — search buys an **~8 pp per-seat edge** where multi-player tempo and blocking matter. Expectimax does not scale here (exponential in player count).
- **Honest research posture:** We document negative and near-parity results before any “stronger AI” claim.

**Product status:** Class I* is an optional local opponent tier, labeled experimental. It is **not** a TEI reference band until it beats Class II with statistical significance. **Recommended play backend:** expectimax for 2p, ISMCTS for 3p+ go-out (§4.6).

#### Compute note (not yet cluster-scale)
The current pipeline is **laptop-first**, not HPC-optimized:
- **Collection / bench** — single-threaded Node game simulation (engine fidelity over throughput).
- **Training** — small MLP on CPU by default; PyTorch MPS (Apple GPU) is not wired; batch size 64.
- **Parallelism today** — heuristic weight optimizer (`AI_OPTIMIZER_PARALLEL`) uses worker threads; Class I* collect/train/bench does not yet fan out across many cores.

This is intentional for reproducibility and browser deployment, but it means **more games and iterative self-play**, not more cores, is the current lever for strength.

#### Fleet Admiral — multi-engine strategy (2026-06-30)

Large-scale parallel benches (1,500 games, M4 Max, ~1,400% CPU) showed that **no single search algorithm dominates every mode**. Mexican Train changes its game-theoretic profile by player count and objective:

| Lobby setting | Recommended backend | Why |
|---------------|---------------------|-----|
| **2p points** | **Expectimax** (depth 4, 16 determinizations) | ~64% vs Commander; ISMCTS flatlines at ~51% — greedy heuristics already near-optimal for pip-dumping |
| **2p go-out** | **Expectimax** (depth 3, 12 det) | ~56% at 500 games; tighter tactical race |
| **3p+ go-out / points** | **ISMCTS** (300ms, belief constraints) | Expectimax blows up in N; ISMCTS 31.2% sector wins at 4p vs ~23% per greedy seat |
| **Tactical advisor (UI)** | **Commander heuristics only** | Fast, explainable; never calls net or deep search |

```
                    ┌─────────────────────────────────────┐
                    │     Tactical Advisor (player UI)     │
                    │   Commander heuristics + explain    │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │         Class I* play path         │
                    └─────────────────┬─────────────────┘
                          ┌───────────┴───────────┐
                    2 players                 3+ players
                          │                       │
                   Expectimax              ISMCTS
              (fixed depth, belief)   (time budget, belief)
```

| Component | Location |
|-----------|----------|
| Expectimax preset | `resolveFleetAdmiralExpectimaxLookahead()` |
| ISMCTS preset | `resolveFleetAdmiralLookahead()` |
| Belief constraints | `assignHiddenHands()` — mandatory-play pins, blocked-pile consistency |
| Time-boxed advisor | `resolveDeepThinkAdvisorLookahead()` — 250ms ISMCTS (`ADVISOR_DEEP_THINK=1`) |
| Parallel bench | `yarn fleet-admiral:bench:500` with `AI_BENCH_PARALLEL=1 AI_BENCH_WORKERS=15` |

```bash
yarn fleet-admiral:bench:500                    # ISMCTS vs Commander (default)
FLEET_BENCH_SEAT=b yarn fleet-admiral:bench:500 # seat symmetry
yarn fleet-admiral:bench:go-out-4p:500          # 4p go-out ISMCTS
yarn jiti tools/nn/compare-fleet-search.ts      # expectimax vs ISMCTS head-to-head
```

**Engineering verdict on heuristics:** Flat ISMCTS parity in 2p points does **not** mean bad heuristics or missing knobs. It means Commander already finds the dominant greedy line; deeper Monte Carlo search mostly **re-confirms** it. Expectimax wins in 2p because it **exhaustively averages** immediate responses without rollout noise — a different tool for a different information structure.

#### Design constraints (non-negotiable)
1. Coach/advisor never calls the model.
2. Residual is additive on heuristics — humans can still read heuristic explanations.
3. Negative results are documented in [calibration-log.md](./calibration-log.md) before any “stronger AI” marketing.

### 4.6 Multi-engine play routing (product decision)

**Do not force one search algorithm on every lobby.** Route by player count and objective:

| Condition | Play backend | Bench evidence |
|-----------|--------------|----------------|
| 2p + points | Expectimax depth 4 | **64.4%** vs Commander (500g) |
| 2p + go-out | Expectimax depth 3 | **55.8%** vs Commander (500g) |
| 2p + any | ISMCTS | **51.1%** combined (1000g) — parity |
| 3p+ + go-out | ISMCTS | **31.2%** sector wins at 4p vs ~23% per greedy seat |
| Advisor UI | Commander heuristics | Always — no net, no deep search in coach path |

**Why heuristics are not “bad”:** If Commander were weak, ISMCTS would exploit blunders at 4,000 iterations. The 2p dead heat means Commander is already at a **local maximum** for pip-dumping; expectimax extracts the remaining edge via combinatorial averaging, not better heuristics.

**Open bench gap:** Current 4p go-out tally is “1× ISMCTS vs 3× greedy Commander” with wins split across four seats. A cleaner test — ISMCTS vs 3× expectimax, or 2p go-out ISMCTS with seat symmetry — remains on the roadmap before claiming ISMCTS over expectimax in all multi-player modes.

### 4.7 Class Ω — Standalone Self-Play Policy/Value

Class I* and every prior neural pass shared one fatal design choice: **Commander was the training target**. Whether by imitation or regret, the optimum the net could reach was a Commander clone. Class Ω removes the tether entirely to create a pure self-play neural opponent designed for fleet games (3–8 players).  

#### Architecture
```
policy_head:  state+action features (303) → MLP → logit per candidate → softmax
value_head:   state features (195)         → MLP → tanh → E[outcome for acting seat]
pick = argmax policy   (greedy at play; temperature-sampled during self-play)
```

- **Standalone:** No heuristics or `scoreWithHeuristics` term in the objective[cite: 1, 3].
- **No Commander Target:** The net is trained purely on game outcomes, avoiding the imitation trap.  
- **Opaque by Design:** Cannot explain moves in heuristic terms[cite: 1, 3].

- #### The Credit Assignment Breakthrough

  Early runs labeled every decision using the final 13-round campaign winner. This introduced massive noise, as a brilliant move and a blunder in round 3 received the exact same ±1 reward based on cumulative pips tallied ten rounds later.  

  - **The Fix:** We implemented per-round graded rank rewards.  
  - **Mathematical Justification:** Because a campaign is simply the sum of independent per-round pip totals with hands re-dealt each round, minimizing per-round pips accurately minimizes the cumulative campaign total.  
  - **Result:** This produced a dense, immediate signal with a roughly 50/50 label balance (one winner, one loser per 2p round), acting as the primary accelerant that unlocked 2-player parity.  

  #### Training Stability & The Policy Collapse

  Raw REINFORCE training proved highly unstable. During iteration 4, the policy collapsed, dropping from a 41.5% peak win rate back to 31%.  

  - **Root Cause:** Uncentered binary outcomes caused the network to penalize all moves by a losing seat, arbitrarily over-sharpening the logits and destroying data diversity.  
  - **Stability Guards:** We implemented advantage standardization (zero mean, unit variance), a 3σ advantage clamp, a 0.05 entropy bonus, and gradient-norm clipping to bound weight changes.  
  - **Champion Gating:** To prevent regressed networks from compounding errors, we introduced AlphaZero-style champion gating. Candidates are now evaluated across bench slices and only promoted if they beat the shipped champion network, ensuring a strictly monotonic skill ladder. The Adam learning rate was also lowered to 3e-4 to prevent warm-start overshoot.  

  #### The Pivot to Path B: ISMCTS-Distillation

  While 2-player models achieved parity, pure REINFORCE stalled at near-random baselines for fleet sizes (3–8 players). The network had ample capacity (policy top-1 ≈ 0.94), but the value baseline could not accurately predict placement against up to seven hidden hands—an imperfect-information wall.  

  To overcome this, we pivoted to **Path B (ISMCTS-Distillation)**:

  - Instead of raw self-play sampling, each decision during training runs value-net-independent ISMCTS with Commander-heuristic rollouts.  
  - This generates a sharp visit-count distribution (approximately 0.90 top-move share).  
  - The policy head is trained to match this search distribution via cross-entropy, rather than REINFORCE on the sampled move.  
  - **Crucial Distinction:** Commander is only used as a rollout simulator to generate the search target. The shipped inference network runs purely on its own without Commander, avoiding the Class I* imitation trap since the target is the *search visit distribution*, not the Commander's specific picks.

#### Product ship (2026-07) — Class II = Ω

Ω **replaces** heuristic Commander for the player-facing Class II tier (local, online host, pass-and-play). Same TEI bucket (`commander`); no separate “Ω” lobby tier.

| Mode | Bench vs legacy Commander (200g/slice, 2026-07 sign-off) | Product |
|------|----------------------------------------------------------|---------|
| Points 2p | ~1.02–1.06× fair share (~parity) | Rated greedy Ω |
| Points 4–8p | ~1.24–1.72× | Strength concentrates in large fleets |
| Go-out 2p | seat A ~1.01×, seat B ~0.86× (race variance) | Not a reason to keep two Class II stacks |
| Go-out 3–8p | mean pull to ~1.14× overall | Rated greedy Ω |
| Ω+ (PUCT @ ~480) | Stronger exhibition; same weights | **Unrated** checkbox |

**TEI recalibration:** ship `warp12-official-v2`. Class II REF_TEI **1520 points / 1550 go-out** (from heuristic **1400 / 1500**). Early draft anchors **1680 / 1650** were rejected after sign-off benches — they over-read large-fleet fair-share while typical solo rated play is 2–4p.

**Advisor (phase A):** coach pick follows greedy Ω; explanations remain heuristic (`explainWarpAiAction`). Assisted play stays unrated.

---

## 5. TEI (Tactical Effectiveness Index)

**Normative spec:** [tei-spec.md](./tei-spec.md) — formal definition, human multiplayer updates, conformance vectors.

### 5.1 Reference bands
Fixed opponent TEI for unassisted matches. **v1** = heuristic Class II; **v2** = neural Class II (Ω). New rated play defaults to v2; legacy crews may pin v1. Human stored TEI integers are **not** re-banded when anchors change.

| Track | Class IV | Class III | Class II (v1 heuristic) | Class II (v2 Ω) |
|-------|----------|-----------|-------------------------|-----------------|
| Points | ~1000 | ~1200 | ~1400 | **~1520** |
| Go-out | ~1000 | ~1250 | ~1500 | **~1550** |

**Calibration rule of thumb:** set Class II REF near where a captain of that TEI wins ~50% **in the table sizes you actually rate** (Warp 12 solo local play is mostly 2–4). Fleet-mean fair-share against legacy Commander is a promotion metric, not a direct Elo Δ.

### 5.2 Update rule
- Standard Elo expected score + K-factor schedule (40 → 32 → 24 by experience).
- Separate buckets: objective × AI class × (human profile).

### 5.3 Percentile boards
- Go-out raw TEI gaps compress; percentile (“Top X%”) preserves rank meaning.

### 5.4 Starfleet Academy
- One-time starting TEI pick per track within class band.

---

## 6. Calibration methodology

### 6.1 Self-play loop
- `playSelfPlayGame` drives full games through `applyAction`.
- Blocked-round stall guard for pile-empty lockups.

### 6.2 Evaluation suites
1. **Head-to-head matrix** — all Class IV–II pairs, both objectives.
2. **Symmetric seating** — same-skill first-seat win rate ≈ 50%.
3. **Focus matchups** — one strong captain vs N−1 weaker; rotate seat; table sizes 3–8 (go-out).
4. **House-rule sanity** — e.g. Drop to Impulse penalty pass (`calibrate:ai-tei-dti`).

### 6.3 Metrics
- Completion rate (≥ 85% games decisive).
- Higher-skill win rate vs ordering thresholds.
- Implied ΔTEI from win rate: `400 × log10(p / (1−p))`.
- Expected win rate from reference band spacing.

### 6.4 Weight optimizer (go-out)
- Coordinate search over tunable heuristic weights.
- Loss vs `GO_OUT_CALIBRATION_TARGETS` (tier ordering + 4p focus floors).
- Parallel worker scoring (`AI_OPTIMIZER_PARALLEL`).

### 6.5 Reproducibility
```bash
yarn calibrate:ai-tei
AI_CALIBRATION_GAMES=500 yarn calibrate:ai-tei
yarn calibrate:ai-tei-dti
yarn optimize:ai-weights
```

| Env var | Role |
|---------|------|
| `AI_CALIBRATION_REPORT=1` | Print human report |
| `AI_CALIBRATION_GAMES` | Games per matchup (200 report / 150 CI default) |
| `AI_CALIBRATION_DROP_TO_IMPULSE=1` | Append DTI sanity block |
| `AI_WEIGHT_OPTIMIZE=1` | Full optimizer print pass |
| `AI_OPTIMIZER_GAMES` | Games per optimizer score |
| `AI_OPTIMIZER_ITERATIONS` | Search iterations |
| `AI_OPTIMIZER_PARALLEL` | Worker threads (`0` = off) |
| `AI_OPTIMIZER_WORKERS` | Cap workers (0 = auto) |

Seed fixed at `9001` for calibration reports.

---

## 7. Results (insert latest run)

See **[calibration-log.md](./calibration-log.md)** for dated self-play and optimizer runs. Summary (2026-06-29):

### 7.1 Points (default rules, 200 games/matchup)
Paste output from `yarn calibrate:ai-tei`. Example structure:
- Symmetric ~50/50 seating.
- Class IV vs III ~88% (expected ~76%) — ordering clear, gap may exceed target.
- Class IV vs II ~91.5% (expected ~91%) — on target.
- Class III vs II ~63% (expected ~76%) — compressed but ordered.

### 7.2 Go-out
- Symmetric ~46–56%.
- Class III vs II heads-up ~51% — near coin flip at 200 games.
- 4p focus: Class II ~38.5% vs 25% random; Class III ~27% vs 25%.

### 7.3 Drop to Impulse sanity
- Completion and ordering preserved; no separate weight matrix required.

### 7.4 Optimizer
- Baseline vs optimized loss reduction from `yarn optimize:ai-weights`.

### 7.5 Class I*, Fleet Admiral, and Class Ω Benches

**Neural residual (MLP - Class I\*):**

- **v1 (go-out):** 48.6% win (500g, 2p).  
- **v2 (points):** 97.6% top-1, 1.4% flip, 51% win — Commander clone.  
- **v3 (RL regret):** 49.2% win — parity persists.  

**Fleet Admiral (Search):**

- **Expectimax:** 64.4% points 2p, 55.8% go-out 2p vs Commander (500g each).  
- **ISMCTS (1,500 games):** 51.1% combined in 2p points (dead heat); 31.2% sector wins in 4p go-out vs ~22–23% per greedy Commander seat.  

**Class Ω (Self-Play → Class II):**

- **2-Player:** Points ~parity with legacy Commander; go-out seat-symmetric noise (one soft seat is not a shipping blocker).
- **Fleet (3–8p):** Points fair-share rises with table size (peak ~1.7× at 7–8p); go-out milder (~1.0–1.5× by slice). Overall means ~**1.38×** points / ~**1.14×** go-out at 200g/slice.
- **Ship decision:** replace Class II with greedy Ω; temper REF_TEI to **1520 / 1550**; keep Ω+ and Class I* off the rated ladder.
- **Lesson:** `fairShare × n` win rates at large N inflate mean strength vs what heads-up TEI players feel.  

---

## 8. Discussion

### 8.1 What calibration teaches
- **Points** behaves like a smooth skill ladder — good fit for fixed TEI spacing.
- **Go-out** behaves like a stochastic race — ordering survives, magnitudes don’t.
- **Table size** erodes heads-up skill signal — focus tests essential.
- **House rules** mostly reshape legality — heuristics gated at runtime suffice for DTI.
- **Commander heuristics are a ceiling in 2p points** — ISMCTS parity is confirmation, not failure; expectimax extracts the residual edge via explicit tree search.
- **Search value is mode-dependent** — expectimax for 2p, ISMCTS for multi-player chaos (§4.6).
- **Neural Class II can replace heuristics without a second lobby tier** — keep σ=`commander`, update `rulesProfileId` + REF_TEI.
- **Fair-share ≠ Elo bump** — translating fleet-mean Ω/Commander ratio with `400 log10(fs)` overstates anchors when most rated matches are 2–4p; temper for the rating context you ship.
- **Imitation nets (Class I\*) plateau at the teacher;** Ω succeeds by targeting search visit distributions (Path B), not Commander picks.

### 8.2 Design recommendations
- Never merge points and go-out TEI.
- Show percentile on go-out boards.
- Don’t expose lookahead / Ω+ as a rating-affecting toggle without Δ_search or marking unrated.
- Retune weights selectively (popular hosted configs), not full combinatorial grid.
- Recalibrate REF_TEI when Class II **implementation** changes; do not rewrite stored human ratings.
- Prefer one strong rated tier over “Commander + Omega + Class I*” confusion.

### 8.3 Limitations
- Heuristic agents, not equilibrium solvers.
- Calibration seed and game count sensitivity.
- No human champion study yet.
- Module combinations not exhaustively calibrated.

---

## 9. Path to “Deep Blue of Mexican Train”

Deep Blue beat the world champion at **chess** — a two-player, perfect-information, zero-sum game with decades of theory and endgame tablebases. Mexican Train differs on every axis that made Deep Blue possible.

### 9.1 Why “solving” Mexican Train is a different problem

| Chess (Deep Blue) | Mexican Train (Warp 12) |
|-------------------|-------------------------|
| 2 players | 2–8 players |
| Perfect information | Hidden hands + hidden draw order |
| Zero-sum | Multi-player partial competition |
| Stable objective | Points *or* go-out (different games) |
| Minimax sound | No single “optimal” line vs N−1 opponents |
| Endgame databases | Stochastic draw chain; round recycle |

**Conclusion:** There is no analogous “proof” or full tablebase. Superhuman MT means **strong belief-state play under uncertainty**, not brute-force enumeration.

### 9.2 What “Deep Q class” would mean operationally

A reasonable definition for Mexican Train:

1. **Beat the best known human specialists** consistently across both objectives.
2. **Robust across table sizes** (2–8) and common house-rule bundles.
3. **Exploits imperfect-information inference** — hand range modeling, draw equity.
4. **Demonstrably above Class II** with statistical significance (not just +50 Elo — +300+ implied gap vs current Class II).
5. **Reproducible** — documented training, open benchmarks.

### 9.3 Gap from current Warp 12 stack

| Layer | Today (Class II = Ω) | Class I* / Fleet Admiral | Deep Q class |
|-------|----------------------|--------------------------|--------------|
| Policy | Greedy neural Ω (points + go-out weights) | Heuristic + optional residual / search | Learned policy or CFR blueprint |
| Search | Optional Ω+ PUCT (unrated exhibition) | **Multi-engine:** expectimax 2p, ISMCTS 3p+ | Continual re-planning + belief particles |
| Belief state | Ω features + training-time Path B search | Belief constraints in search | Bayesian / particle beliefs |
| Training | Self-play + Path B distillation; champion gates | 1000-game trajectories + MLP (imitation → regret) | Millions–billions of self-play trajectories |
| Multi-player | Ω fair-share rises with fleet size (points) | ISMCTS ~31% at 4p go-out vs ~23% greedy | Equilibrium approximation (e.g. NFSP, PSRO) |
| TEI | `warp12-official-v2` Class II @ 1520 / 1550 | Experimental / Δ_search if ever rated | New rules profile + human study |
| Compute | Browser fetch of JSON/ONNX; greedy ms/move | Parallel bench on M4 Max | GPU cluster weeks/months |
| Verification | Full 2–8p Ω vs Commander benches | Expectimax 64% 2p points; ISMCTS 51% 2p | Human champion matches + ablations |

**Rough effort:** not a feature sprint — a **multi-year research program** with specialized team (engine + ML + domain expert + UX).

### 9.4 Staged roadmap (if pursued)

#### Phase 0 — Benchmark (3–6 months)
- Freeze ruleset + house-rule profiles for research.
- Publish reproducible harness (already mostly exists: `warp12-engine` self-play).
- Recruit / identify strong human players; run Class II vs human study.
- Establish baseline win rates by objective and player count.

#### Phase 1 — Strong search (6–12 months) — **partially complete**
- Information-set MCTS + determinized expectimax on existing engine.
- **Result (2026-06-30):** Expectimax wins 2p; ISMCTS wins multi-player go-out per-seat rate; neither replaces Commander for advisor UI.
- **Deliverable:** Multi-engine Class I* play routing (§4.6), not a single “ISMCTS everywhere” tier.

#### Phase 2 — Learned value / policy (1–2 years) — **Ω Class II shipped; Path A next**

- Collect self-play dataset; Path B ISMCTS-distillation for fleet scaling.
- **Shipped:** greedy Ω as Class II; separate points / go-out weight files; TEI v2 anchors.
- **Graduate to Path A:** strengthen value head so PUCT / value leaves improve with search budget (Ω+ currently does not scale cleanly with more iterations).
- **Advisor phase B:** concept-bottleneck net trained to agree with Ω (not Commander).  

#### Phase 3 — Multi-player equilibrium (research frontier)
- 3+ players: optimize for **utility / placement** not pure win rate.
- Techniques: PSRO, NFSP, or simplified 3-player subgames.
- May need to define “optimal” as **maximize expected campaign score** (points) or **win probability** (go-out).

#### Phase 4 — Champion preparation (Deep Blue parallel)
- Study human champion games (if recorded).
- Adversarial tuning against specific styles.
- Live match protocol (like Deep Blue vs Kasparov).

#### Phase 5 — Claim the title
- Public match: engine vs best human Mexican Train specialists.
- Both objectives, agreed house rules, multiple table sizes.
- Independent adjudication of rules disputes.

### 9.5 What you *don’t* need for a great product

Warp 12’s goal is **fun, fair, calibrated AI** — not Nash equilibrium. Class IV–II + TEI + coach already deliver:
- Interpretable opponents.
- Measurable human progress.
- Shippable compute on phones and browsers.

Deep Q depth trades away explainability, build cost, and mobile feasibility.

- ### 9.6 The Explainability Problem & Omega Advisor

  Ω decisions are opaque logits. **Phase A (shipped):** advisor **picks** from greedy Ω, **explains** with the legacy heuristic stack (`explainWarpAiAction`) — better target than Class I* “imitate Commander,” still not a full concept-bottleneck.

  **Phase B (proposed):** a **Concept-Bottleneck Network** —

  - Intermediate layer predicts ~20 named game concepts (engine-derived ground truth).
  - Final head trained to agree with Ω (or Ω+ search distribution), not Commander picks.
  - UI can surface genuine concept scores instead of post-hoc rationalizations.  

---

## 10. Conclusion

TEI and self-play calibration provide a **practical, honest skill ladder** for a game too messy for classical solving. Points and go-out should be treated as **two calibration targets** on one engine. **Class I\*** and Fleet Admiral benches show that **no single algorithm wins every mode**: Commander heuristics are near-optimal in 2p points (ISMCTS ~51%), expectimax extracts a ~64% edge there via explicit tree search, and ISMCTS outperforms greedy seats in 4p go-out (~31% vs ~23%). **Class Ω** shows that a pure self-play net can **replace** heuristic Class II without a fourth lobby tier — but **promotion benches and TEI anchors are different jobs**: fleet fair-share can look large while heads-up play stays near parity; REF_TEI must follow the tables you rate. The right product move is **one neural Class II, tempered anchors, unrated search as hard mode**, not more named tiers. Superhuman Mexican Train remains a **research program** (belief-state search + Path A value + human validation), not required for an excellent commercial experience.

---

## Appendix A — Figure list (planned)

1. Architecture diagram: UI → engine → AI policy → TEI update.
2. Calibration matrix heatmap (higher-skill win rates).
3. Points vs go-out implied ΔTEI comparison bars.
4. 4-player focus win rate vs random baseline by table size.
5. Example position where points and go-out best moves diverge.

## Appendix B — Code map

| Concern | Location |
|---------|----------|
| Skill presets | `libs/engine/src/lib/ai/skill.ts` |
| Heuristics | `libs/engine/src/lib/ai/heuristics.ts` |
| Self-play | `libs/engine/src/lib/ai/self-play.ts` |
| Calibration | `libs/engine/src/lib/ai/ai-elo-calibration.ts` |
| Optimizer | `libs/engine/src/lib/ai/ai-weight-optimizer.ts` |
| Fleet Admiral / ISMCTS | `libs/engine/src/lib/ai/fleet-admiral.ts`, `ismcts.ts` |
| Expectimax preset | `resolveFleetAdmiralExpectimaxLookahead()` in `fleet-admiral.ts` |
| Parallel bench | `libs/engine/src/lib/ai/bench-fleet-admiral-parallel.ts`, `tools/nn/bench-fleet-admiral.ts` |
| Class I* policy | `libs/engine/src/lib/ai/class1-star-policy.ts` |
| Class I* features | `libs/engine/src/lib/ai/feature-encoder.ts` |
| Class I* training | `tools/nn/` (`collect`, `train.py`, `bench`) |
| Class Ω agent / search | `libs/engine/src/lib/ai/omega-agent.ts`, `omega-search-agent.ts`, `omega-search.ts` |
| Ω collect / bench | `collect-omega-trajectories.ts`, `bench-omega.ts`, `tools/nn/` |
| Human TEI update | `apps/Warp12/src/firebase/stats-elo.ts`, `libs/tei-core/src/stats-elo.ts` |
| Rules profile / anchors | `warp12-official-v1` / `v2` in `rules-profile.ts` |
| Rules spec | `RULES.md` |

## Appendix C — Target venues

| Venue | Fit |
|-------|-----|
| **AIIDE** | Best fit — game AI + evaluation |
| **IEEE CoG** | Strong — agents + competition |
| **FDG** | Game design + dual objective angle |
| **CHI PLAY** | Advisor / TEI integrity angle |
| **arXiv cs.AI** | White paper / preprint |

---
