# Class Ω — Next Steps (ISMCTS + Beyond)

Handoff document for any AI assistant continuing this work. Written 2026-07-04.

---

## Current state

A pure self-play policy/value net ("Class Ω") is training via an automated loop:

```
yarn omega:loop   # or: scripts/omega-train-loop.sh
```

Each iteration:
1. **Collect** — the current net plays itself (all seats, temperature=1 exploration) → JSONL trajectories (parallel across all cores via worker threads).
2. **Train** — actor-critic (REINFORCE + value baseline + entropy bonus) on the Apple MPS GPU. Train targets are purely win/loss (+1/−1); Commander appears nowhere.
3. **Bench** — net (greedy argmax) vs Commander across player counts, both seats; implied Elo gap per slice written to `tools/nn/data/omega-elo-log.jsonl`.

**Journey so far (2026-07-04):**
1. **2p REINFORCE** — worked after fixing collapse (champion gating) and, decisively, **per-round credit assignment** (below). Reached 2p parity with Commander in 3 iterations. 2p specialist archived at `tools/nn/data/omega-2p-champion.json`.
2. **Pivot to fleets (2–8p)** — the product. Pure REINFORCE stalled at ~random across fleet sizes: `policy_top1≈0.94` (ample capacity) but `value` loss stuck ~0.5 — the value baseline can't predict placement with 7 hidden hands (the imperfect-information wall). Not a capacity problem; a signal problem.
3. **ISMCTS-guided targets (current)** — value-net-guided search cold-started to near-uniform visits (top-move share ~0.28 at 300 iters) because the value net is too weak to concentrate. So we adopted **Path B**: Commander-heuristic rollouts as the search leaf signal (AlphaGo-style scaffolding). This produces sharp targets (top-move share ~0.90) and **distills search-improved play into the net via cross-entropy** — stable, and able to exceed greedy Commander (search beats Class II, cf. Fleet Admiral 64% at 2p). Commander is a rollout *simulator* only; the shipped net runs pure, no Commander at inference. Not the Class I\* trap (target = search visit distribution, not Commander's picks).

Current run: **20 iterations × 500 mixed-fleet games × 8 epochs**, ISMCTS 160 iters/decision, gate on fleet slices (3/4/6/8).

**Upgrade path to pure (Path A):** once the value head is strong (trained on search value backups), switch `omegaSearchVisits(..., { leaf: 'value' })` to drop heuristic rollouts entirely — the AlphaGo→AlphaZero progression. The plumbing already supports both via the `leaf` option in `omega-search.ts`.

---

## Credit assignment — per-round labels (shipped 2026-07-04)

**Problem found via champion-gating diagnostics.** With gating stopping the
collapse, the run climbed but *slowly* — 5 promotions in 27 iterations, 2p
crawling from ~35% to ~45%. Most candidates came out worse than the champion,
i.e. the base learning signal was weak. Root cause: for **points**, self-play
plays full **13-round campaigns** and the original code labeled *every* decision
with the *final campaign winner*. A good move and a blunder in round 3 got the
same ±1 based on cumulative pips 10 rounds later — almost pure noise on most
decisions.

**Fix (in `collect-omega-trajectories.ts`):** label each decision by its **round's**
outcome (lowest-pip captain that round = +1, else −1), not the campaign winner.
This is *correct*, not just denser: campaign points = the **sum** of independent
per-round pip totals (hands re-dealt each round, no carryover but the score
itself), so minimizing per-round pips exactly minimizes the cumulative total.
Go-out is unchanged (round winner = who emptied their hand).

Result: ~3× more usable decisions per game and **~50/50 label balance** (each 2p
round has one winner, one loser) — dense, immediate, correctly-aligned signal.
`recordRoundWinner()` computes per-round winner sets from score deltas; decisions
are tagged with `roundNumber` and labeled at game end.

This is expected to sharply accelerate the gated climb. If it does, ISMCTS
targets (below) become a *further* accelerant rather than a necessity.

---

## What ISMCTS-guided targets mean and why they're the next lever

### Problem with raw REINFORCE
Right now, the training target for the policy is the *move the net actually sampled* during self-play, up-weighted by the advantage (outcome − value prediction). This is high-variance: a move can be labeled "good" simply because the net happened to win despite it, not because the move itself was strong. The net has to see the same state *many times* before signal overcomes noise.

### The AlphaZero insight
Instead of using the net's raw sample as the policy target, **use search (ISMCTS) to produce an improved move distribution**, then train the policy to match that. Concretely:

1. At each decision during self-play, run N iterations of ISMCTS rooted at the current state, using the **value head** to evaluate leaf nodes (instead of random rollouts). ISMCTS already handles the imperfect-info via determinizations.
2. The visit counts across root children form a *sharpened* probability distribution — this is a better estimate of which move is best than the net's prior alone.
3. Store that visit-count distribution alongside the game outcome.
4. Train the policy head to match the search distribution (cross-entropy) instead of just REINFORCE on the sampled move. Train the value head on the game outcome as before.

This turns one iteration of data into *much* higher-quality targets, so the net improves faster per game played.

### Why wait until now (not from the start)
The value head has to be non-random for leaf evaluation to be useful. If the value head returns ~0 for everything, ISMCTS rollouts are the same as random rollouts, and the visit-count distribution is just ISMCTS being random — no improvement over the net's own random prior. So: wait until `omega-elo-log.jsonl` shows value loss dropping (currently ~0.98, dropping fast) and Elo gap rising (even if still negative). Once value loss is <0.5 or Elo gap is >−200, ISMCTS targets will start paying off.

---

## Implementation plan for ISMCTS-guided targets

### Files to modify / create

| Action | File | What to do |
|--------|------|------------|
| Modify | `libs/engine/src/lib/ai/collect-omega-trajectories.ts` | Add a `searchIterations` option. When >0, run ISMCTS at each decision to produce a visit-count policy target (stored alongside existing fields). |
| Create | `libs/engine/src/lib/ai/omega-ismcts-eval.ts` | A leaf evaluator for the ISMCTS tree that calls `forwardOmegaValue(encodeOmegaStateFeatures(ctx), net)` instead of doing a random rollout. Wrap as a `WarpSearchModel`-compatible value function. |
| Modify | `libs/engine/src/lib/ai/collect-omega-trajectories.ts` → `OmegaTrajectoryRow` | Add optional `searchPolicy?: number[]` — the ISMCTS visit-count distribution over the same candidate ordering as `features[]`. Present when search was used. |
| Modify | `tools/nn/train-omega.py` | When a group has `searchPolicy`, use **cross-entropy against that distribution** as the policy loss (weighted by advantage) instead of REINFORCE on the single chosen action. Value loss stays MSE on the outcome. Fall back to REINFORCE for groups without `searchPolicy` (backward compat). |
| Modify | `tools/nn/collect-omega-trajectories.ts` | Pass `searchIterations` option from env var `OMEGA_SEARCH_ITERS` (default 0 = current behavior). |
| Modify | `scripts/omega-train-loop.sh` | After N initial REINFORCE iterations, set `OMEGA_SEARCH_ITERS=200` (or whatever budget the M4 Max can handle in <250ms/decision — profile it). |

### Key design constraints

- **Imperfect information**: use the existing ISMCTS + determinization + belief constraints harness (`ismctsSearchActionValues` in `libs/engine/src/lib/ai/ismcts.ts`). It already handles hidden hands via sampling determinizations that pass belief constraints.
- **The net replaces random rollouts**: currently ISMCTS uses greedy heuristic rollout policy. Replace the rollout/leaf eval with `forwardOmegaValue`. The existing `ismctsSearchActionValues` takes a `WarpSearchModel` whose `leafEval` can be swapped. Study `search-model.ts`'s `warpLeafEval` for how the interface works — you'll provide an alternate that calls the Omega value head.
- **Keep the non-search path working**: `OMEGA_SEARCH_ITERS=0` must still produce the current pure-REINFORCE data. The trainer must handle both formats.
- **Budget**: ISMCTS iterations per decision. Profile empirically on the M4 Max. Target: 200–400 iterations with value-head eval should take <100ms per decision (the forward is cheap — 195-dim → [256,128] → 1 scalar). If too slow, reduce to 100.
- **N-player support**: ISMCTS already works at 3+ players (the existing harness routes to it there). When collecting at 3p/4p with search targets, this should "just work" if you pass the right `perspective` field.

### Existing ISMCTS harness (what you're plugging into)

```typescript
// libs/engine/src/lib/ai/ismcts.ts
ismctsSearchActionValues(
  rootState: GameState,
  searchModel: WarpSearchModel,     // ← you'll provide an Omega-backed one
  options: IsmctsOptions,           // perspective, rng, timeBudget/iterations, maxBranch
  actionKey: (action) => string     // use warpAiActionKey
): ScoredIsmctsAction[]             // { action, value, visits }
```

The `WarpSearchModel` interface (in `search-model.ts`) has:
- `legalActions(state, playerId)` → candidates
- `applyAction(state, action)` → next state
- `leafEval(state, perspective)` → number (the thing you swap to use the value head)
- `determinize(state, perspective, rng)` → state with hidden info sampled

You create an Omega-specific search model where `leafEval` calls the value head.

### Trainer changes (Python)

```python
# When searchPolicy is present in a group:
search_target = torch.tensor(group["searchPolicy"], dtype=torch.float32)  # [C]
search_target = search_target / search_target.sum()  # normalize visits to probs

# Policy loss = KL(search_target || policy_softmax), weighted by advantage
logits = policy(features)  # [C]
log_probs = F.log_softmax(logits, dim=0)
policy_loss = -(search_target * log_probs).sum() * advantage.abs()

# Value loss unchanged: MSE(value_pred, game_outcome)
```

This replaces the per-sample REINFORCE gradient with a per-distribution target. It is strictly higher signal-to-noise per decision.

---

## After ISMCTS targets are working: the full roadmap

1. **ISMCTS-guided iterations (this doc)** — the single biggest quality multiplier. Gate on value loss <0.5.
2. **Multi-player + go-out collection** — once 2p points Elo is rising, expand `OMEGA_PLAYERS=3,4` and `OMEGA_OBJECTIVE=go-out` iterations. Mix data across configurations per iteration (or alternate) so the net learns broadly.
3. **Promotion gate** — when `omega:bench` shows >60% win rate across 2p/3p/4p, both objectives, on 500-game runs, the net clears the +300 implied-Elo bar and can be promoted to a rated tier. Wire a reference TEI band into `stats-elo.ts`, flip `local-ai-match-validation.ts` from rejecting Class Ω matches to rating them.
4. **Production integration** — the Omega agent (`createOmegaPlayer`) is already a valid `WarpAiPlayer`. Wire it into the client game config as a selectable opponent tier (similar to how `createClass1StarPlayer` is wired). Load `omega-v1.json` or the ONNX files via the existing ORT session loader.
5. **Optional: ONNX-backed inference during self-play** — if MLP forward becomes a collection bottleneck (unlikely at 303-dim), swap the TS matmul in the worker for ONNX Runtime Node (`onnxruntime-node`), which uses CoreML on Apple Silicon. Only if profiling shows the TS forward is >50% of collection wall-time.
6. **Longer-term: larger net with attention** — if the MLP saturates (training loss plateaus, Elo stops climbing despite more data), upgrade to a small transformer over the candidate set (self-attention over candidate embeddings before scoring). This would require changing the encoder and trainer but not the pipeline structure.

---

## The explainable tier — "Omega Advisor" (the middle we'll find)

**Decision:** build this *after* Omega establishes the strength ceiling. We won't
know how much room exists between Commander (Class II) and Omega until Omega's
numbers land, and the concept vocabulary for a bottleneck should be chosen with
that gap in view.

**The problem it solves.** Omega is intentionally opaque — a policy/value net has
no human-legible "reasons," just matrix multiplies. The current advisor/coach path
is heuristic (`scoreWithHeuristics` + `explainWarpAiAction`) and stays that way; it
explains in named terms (`dumpPips`, `handFlexibility`, …) and advisor-assisted
matches are unrated anyway, so opaque-opponent + explainable-advisor is a clean
split, not a compromise. The open question is whether we can make an advisor that
is **both** explainable **and** as strong as Omega (not just as strong as Commander).

**Why the Class I\* mistake must not repeat.** Class I\* failed because its training
*target* was Commander's picks (imitation / regret-to-Commander). It converged to a
Commander clone by construction. Any explainable tier we distill from Omega must
target **Omega's** decisions, not Commander's — so the explanations describe
genuinely stronger play.

### Three approaches (in increasing lift / honesty tradeoff)

1. **Post-hoc heuristic attribution (cheapest, ship first).**
   After Omega picks a move, run the heuristic scorer on the same candidates and
   surface the heuristic story that best *agrees with* Omega's pick. Honest framing
   required in UI: "approximate rationale," not "the AI's reasoning." Works today,
   no retraining, Omega stays fully strong. Con: the explanation can be wrong —
   Omega may have picked for a reason no heuristic captures.

2. **Concept-bottleneck net (genuinely explainable, medium lift).**
   ```
   state → [concept layer: ~20 named scalars] → scoring head → move
   ```
   Force an intermediate layer to predict *named game concepts* (pip-dump potential,
   hand flexibility, doubles remaining, trail connectivity, opponent go-out
   proximity, Red-Alert exposure, …) before the scoring head reads them. Train the
   concept layer supervised on **ground-truth values derived from the engine state**
   (the *facts* the heuristics measure — NOT Commander's weights), and train the
   scoring head on **Omega-distilled targets / self-play outcomes**. The explanation
   is then real ("hand-flexibility 0.85, trail-priority 0.92 → this pick"), because
   the concepts are the actual information bottleneck the decision flows through.
   Con: caps strength at what the ~20 concepts can express — the interpretability vs
   ceiling tradeoff. Likely lands *above Commander, below full Omega*: exactly the
   "middle."

3. **Natural-language rationalization (most flexible, least honest).**
   A small LM fine-tuned on (state, move, outcome) → explanation. Can say anything,
   but it rationalizes rather than explains (no access to Omega's actual computation).
   Lowest priority; only if product wants prose.

**Recommendation:** ship (1) for the Omega advisor panel labeled as approximate;
build (2) as a distinct second-gen tier once Omega's ceiling is known. The concept
vocabulary is already implicit in the heuristic IDs (`WARP_HEURISTIC_IDS`).

---

## End-state tier ladder

Once Omega proves out, the AI stack simplifies. Fleet Admiral (deep search) and
Class I\* (residual) become **historical predecessors** — they proved search works
(2p expectimax ~64%) and that the residual doesn't (Commander clone). Omega
obsoletes both as the top opponent: stronger (trained to win, not imitate), faster
(no search at play time), and it scales to all player counts.

| Tier | What it is | Explainable? | Rated? |
|------|-----------|--------------|--------|
| Class IV / III / II | Heuristic officers (ensign/lieutenant/commander) | Yes | Yes (fixed anchors 1000/1200/1400 pts) |
| **Class I** | **Human prestige** — earned at **TEI ≥ 1450** (was 1650; lowered so beating Commander ≈ Class I) | — | — |
| **Class Ω** | Self-play neural opponent | No | Yes, once promoted (provisional band **~1700** pts) |
| Advisor / Coach | Heuristic today; later Omega-distilled concept net or post-hoc attribution | Yes | N/A (advisor use disqualifies a match) |

**TEI is extended, not broken.** Omega becomes a new fixed reference anchor above
Commander; a human beating Omega rates 1800+. Add one entry to
`AI_OPPONENT_TEI_POINTS` and flip `local-ai-match-validation.ts` from rejecting
Class Ω to rating it against the new anchor. No existing anchor moves.

**Threshold change already shipped:** `teiToPlayerTacticalClass` Class I cutoff
1650 → **1450**; mirrored in `docs/tei-spec.md` §7.2 and `RULES.md`. Class Ω
reserved (experimental/unrated) in `tei-spec.md`, `RULES.md`, and
`tei-paper-outline.md`.

**No external benchmark exists.** There is no open-source Mexican Train AI to
compare against — the internal ladder (Commander → Fleet Admiral search → Class Ω
self-play) *is* the bar. If Class Ω beats Fleet Admiral's 2p-points expectimax
(~64%) broadly, it's a genuinely novel result (first self-play RL agent for a
multi-player imperfect-information tile game at this complexity).

---

## Path to legendary status — the "Deep Blue of Mexican Train"

The endgame, once Class Ω is strong and stable across 2–8 players:

1. **Break the parity wall with the self-play net.** Push the standalone
   actor-critic past the early policy collapses (done: champion gating +
   per-round credit + ISMCTS distillation). The milestone: the net consistently
   beats **both** the Expectimax and ISMCTS engines **without relying on any
   pre-programmed heuristics at inference** — i.e. graduate from Path B
   (heuristic-rollout scaffolding) to Path A (pure value-guided search), then to
   the bare net. That is superhuman *intuition*: search-strength play with no
   search at play time and no Commander in the loop.

2. **Publish the benchmark ("MT-Bench").** Standardized seeds, house-rule
   profiles, and expected win rates by player count and objective. Ship the
   engine (`warp12-engine`) as the de-facto environment researchers use to test
   imperfect-information algorithms — reproducible, open, and rules-faithful.

3. **Submit to academic venues.** Polish the whitepaper *Self-Play Calibration of
   Heuristic Agents for Mexican Train Under Competing Objectives*
   (`docs/tei-paper-outline.md`) and submit to **AIIDE** (AI and Interactive
   Digital Entertainment) or **IEEE CoG** (Conference on Games). The negative
   results (imitation ceiling, value cold-start) are part of the contribution.

4. **The Kasparov moment.** Once robust across 2–8 players, host a publicized,
   live-streamed match: Warp 12 vs a table of the best human Mexican Train
   specialists we can find, both objectives, agreed house rules, independent
   rules adjudication. There is no reigning champion to dethrone — so this match
   *defines* the title.

Status against step 1: 2p parity reached; fleet distillation (Path B) in progress.
Steps 2–4 unlock once Class Ω clears Class II broadly and earns its rated band.

---

## Environment variables reference (Omega)

| Variable | Default | Purpose |
|----------|---------|---------|
| `OMEGA_GAMES` | 200 | Self-play games per collect |
| `OMEGA_PLAYERS` | 2 | Table size |
| `OMEGA_OBJECTIVE` | points | `points` or `go-out` |
| `OMEGA_TEMPERATURE` | 1 | Exploration temperature (self-play sampling) |
| `OMEGA_WEIGHTS` | `apps/Warp12/public/models/omega-v1.json` | Net weights for collect/bench |
| `OMEGA_POLICY_HIDDEN` | 256,256 | Policy head layer widths |
| `OMEGA_VALUE_HIDDEN` | 256,128 | Value head layer widths |
| `OMEGA_EPOCHS` | 8 | Training epochs per iteration (use ~4 in the loop — refresh data instead) |
| `OMEGA_VALUE_COEF` | 1.0 | Value loss weight |
| `OMEGA_ENTROPY_COEF` | 0.05 | Entropy bonus (keeps exploration alive, prevents policy collapse) |
| `OMEGA_ADV_CLIP` | 3.0 | Clamp *standardized* advantage (z-score, in σ units) |
| `OMEGA_GRAD_CLIP` | 1.0 | Max gradient norm |
| `OMEGA_LR` | 3e-4 | Adam learning rate (lowered from 1e-3 for warm-start stability) |
| `OMEGA_PROMOTE_MARGIN` | 0.0 | Min aggregate win-rate gain for a candidate to be promoted (champion gating) |
| `OMEGA_BENCH_GAMES` | 200 | Games per bench slice |
| `OMEGA_BENCH_PLAYERS` | 2,3,4 | Sweep player counts |
| `OMEGA_WORKERS` | cores−1 | Parallel collection workers |
| `OMEGA_SEARCH_ITERS` | 0 | ISMCTS iters/decision (>0 = search-guided visit targets; Path B heuristic-rollout leaf) |
| `OMEGA_SEARCH_MAX_BRANCH` | 8 | ISMCTS max branching when searching |
| `OMEGA_ITERATIONS` | 10 | Loop iterations |
| `OMEGA_DEVICE` | auto (mps→cuda→cpu) | Force training device |

### Training stability (added after iter-4 policy collapse)

Raw REINFORCE with a value baseline is high-variance and can collapse: the
policy over-sharpens, self-play data loses diversity, and the next iteration
regresses on the bench. Observed live: iter 3 peaked at 41.5% (2p seat a) then
iter 4 fell back to 31%, with training policy loss exploding to −1500.

**Root cause (diagnosed).** The advantages were *uncentered binary outcomes*.
The losing seat gets advantage ≈ −1 on *every* decision, so the gradient says
"make all your moves less likely" — but softmax is normalized, so it can't, and
instead just sharpens logits arbitrarily. Clamping bounds magnitude but not that
systematic pressure. Separately, the surrogate loss has an unbounded
negative-advantage tail: driving P(bad move)→0 sends log-prob→−∞, so iterating
many epochs on the *same* dataset diverges.

**Fixes now in `train-omega.py`:**

- **Advantage standardization** (per batch, zero mean / unit variance) — the key
  fix. The policy learns *relative* move quality this batch instead of pushing
  every losing move down. This is the standard REINFORCE variance reducer.
- **Standardized-advantage clamp** (`OMEGA_ADV_CLIP=3.0`, i.e. 3σ) — no single
  decision dominates.
- **Entropy bonus** (`OMEGA_ENTROPY_COEF=0.05`) — resists collapse to determinism.
- **Gradient-norm clip** (`OMEGA_GRAD_CLIP=1.0`) — bounds per-step weight change.
- **Few epochs per iteration** (`OMEGA_EPOCHS=4`) — REINFORCE should take a gentle
  step then regenerate fresh data. The healthy loop is *more iterations, not more
  epochs* on stale data. Note: policy-loss magnitude is a surrogate, not a
  quantity to minimize toward zero — judge by **bench win rate and stability
  across iterations**, not the printed policy number.

**Standardization was not enough — cross-iteration collapse persisted.** With the
above, the *training loss* stayed bounded, but the *bench* still oscillated:
iter 2 = 41.5%, iter 3 crashed to 18%, iter 4 = 23%. Root cause of the *remaining*
instability: **a regressed net propagates.** Blind warm-start means iter 3's bad
net collects iter 4's data and seeds iter 4's training, so one bad step compounds.

**Fix (current): champion gating (AlphaZero-style) + lower LR.** The loop
(`scripts/omega-train-loop.sh`) now:

- Collects self-play data from the **champion** (the shipped `omega-v1.json`).
- Trains a **candidate** (warm-started from champion) into a scratch dir —
  never overwriting the champion.
- Benches the candidate and **promotes only if its aggregate win rate beats the
  champion** (`OMEGA_PROMOTE_MARGIN`, default 0). A worse candidate is discarded;
  the champion is retried next iteration with fresh data (varied seed).
- `OMEGA_LR` lowered 1e-3 → **3e-4** to reduce the Adam-reset overshoot right
  after each warm-start.

This makes the ladder **monotonic by construction** — the shipped net can only
improve or hold, never regress. Gate metric = total wins / total games across all
bench slices (≈800 games), robust to per-slice noise.

If it plateaus (many consecutive rejections): raise exploration
(`OMEGA_TEMPERATURE`), add more games/iter, or move to the ISMCTS-target work
below (search-visit targets are far lower-variance than sampled-move REINFORCE and
also help structurally). A PPO-style clipped objective is the next lever if
gating alone stalls.

---

## Key files

| Path | Role |
|------|------|
| `libs/engine/src/lib/ai/omega-constants.ts` | Dims, display names |
| `libs/engine/src/lib/ai/omega-encoder.ts` | Policy (303-dim) + state (195-dim) feature encoding |
| `libs/engine/src/lib/ai/omega-net.ts` | Two-head MLP: forward, softmax, zero-init, validation |
| `libs/engine/src/lib/ai/omega-agent.ts` | `createOmegaPlayer` — opaque `WarpAiPlayer` from policy head |
| `libs/engine/src/lib/ai/collect-omega-trajectories.ts` | Self-play collector (single-thread, slice-aware) |
| `libs/engine/src/lib/ai/collect-omega-parallel.ts` | Parallel driver (shards across workers) |
| `libs/engine/src/lib/ai/collect-omega.worker.ts` | Worker entry point |
| `libs/engine/src/lib/ai/bench-omega.ts` | Omega vs Commander eval gate |
| `tools/nn/train-omega.py` | PyTorch trainer (MPS, vectorized, actor-critic) |
| `tools/nn/collect-omega-trajectories.ts` | CLI driver for collection |
| `tools/nn/bench-omega.ts` | CLI driver for bench |
| `scripts/omega-train-loop.sh` | Unattended iteration loop |
| `tools/nn/data/omega-elo-log.jsonl` | Elo trajectory (one line per iteration) |
| `docs/omega-next-steps.md` | This document |
