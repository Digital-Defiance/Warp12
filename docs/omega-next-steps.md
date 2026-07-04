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

The pipeline works end-to-end. The current run is 12 iterations × 1,500 games × 20 epochs.

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
| `OMEGA_EPOCHS` | 20 | Training epochs per iteration |
| `OMEGA_VALUE_COEF` | 1.0 | Value loss weight |
| `OMEGA_ENTROPY_COEF` | 0.01 | Entropy bonus (keeps exploration alive early) |
| `OMEGA_BENCH_GAMES` | 200 | Games per bench slice |
| `OMEGA_BENCH_PLAYERS` | 2,3,4 | Sweep player counts |
| `OMEGA_WORKERS` | cores−1 | Parallel collection workers |
| `OMEGA_SEARCH_ITERS` | 0 | (future) ISMCTS iterations per decision |
| `OMEGA_ITERATIONS` | 10 | Loop iterations |
| `OMEGA_DEVICE` | auto (mps→cuda→cpu) | Force training device |

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
