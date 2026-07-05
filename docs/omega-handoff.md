# Class Ω — Hand-off Status (READ FIRST)

**For:** the next assistant/engineer (Cursor et al.) picking this up.
**Date:** 2026-07-04.
**Deep design + roadmap:** [`omega-next-steps.md`](./omega-next-steps.md) (read after this).

---

## TL;DR

We are training **Class Ω**, a self-play neural opponent for Warp 12 (double-twelve
Mexican Train). Goal: an AI that plays the **fleet game (3–8 players)** stronger
than the hand-tuned Commander (Class II) heuristic, with **no Commander at
inference** — the first trained neural player for this game.

**Right now** an automated training loop is running in the background. It is on the
**Path B (ISMCTS-distillation)** approach. See "Current run" below to check on it.

---

## Where things stand (honest status)

| Milestone | Status |
|-----------|--------|
| Pipeline (collect → train → bench → gate loop) | ✅ built, working end-to-end |
| 2p points: reach parity with Commander | ✅ done (3 iterations, from scratch) — net archived `tools/nn/data/omega-2p-champion.json` |
| Training stability (collapse fixed) | ✅ champion gating + per-round credit + advantage standardization |
| Fleet (3–8p) via pure REINFORCE | ❌ stalled at ~random (imperfect-info value wall) |
| Fleet via ISMCTS-distillation (Path B) | 🔄 **in progress** — the current run |
| Class Ω beats Class II broadly (promotion bar) | ⬜ not yet |
| Wire Ω as a rated tier + into the client | ⬜ not started |
| Explainable "Omega Advisor" tier | ⬜ designed, not built (see next-steps §"explainable tier") |

**Latest numbers** (`tools/nn/data/omega-elo-log.jsonl`): fleet win rates still near
random baselines (3p~0.31/rand 0.33, 4p~0.21/0.25, 6p~0.12/0.17, 8p~0.20/0.125) —
this is iteration 1 baseline; the distillation lift shows over subsequent iterations.

---

## Current run (background process)

```
OMEGA_ITERATIONS=20 OMEGA_GAMES=500 OMEGA_PLAYERS="2,3,4,5,6,7,8" \
OMEGA_SEARCH_ITERS=160 OMEGA_OBJECTIVE=points OMEGA_EPOCHS=8 \
OMEGA_BENCH_GAMES=120 OMEGA_BENCH_PLAYERS="3,4,6,8" \
OMEGA_ELO_LOG=tools/nn/data/omega-elo-log.jsonl bash scripts/omega-train-loop.sh
```

- **Champion (shipped net):** `apps/Warp12/public/models/omega-v1.json` (+ `omega-policy-v1.onnx`, `omega-value-v1.onnx`). Updated only when a candidate beats it (gating → monotonic).
- **Approach:** each decision runs value-net-independent **ISMCTS with Commander-heuristic rollouts** (Path B) → sharp visit-count targets (~0.90 top-move share) → net distills them via cross-entropy. Commander is a *rollout simulator only*; the shipped net has no Commander at inference. This is NOT the Class I\* imitation trap (target = search visit distribution, not Commander's picks).

### Check progress
```bash
# Elo trajectory (one line per iteration, PROMOTE/REJECT + fleet win rates)
cat tools/nn/data/omega-elo-log.jsonl | python3 -m json.tool  # or the pretty-printer below
```
```python
import json
for r in (json.loads(l) for l in open('tools/nn/data/omega-elo-log.jsonl') if l.strip()):
    s={f"{x['playerCount']}p":x['winRate'] for x in r['slices']}
    print(r['iteration'], r['decision'], 'agg', r['candidateAggregate'], s)
```

### What "good" looks like
Fleet slices climbing **above random baseline** (3p>0.33, 4p>0.25, 6p>0.17, 8p>0.125)
and toward Commander-share, with steady PROMOTEs. Distillation targets are strong and
net-independent, so expect steadier progress than the earlier REINFORCE grind — but it
will plateau at ~"search strength" (that's expected; see "next levers").

---

## Immediate next actions (in priority order)

1. **Let the current Path B run finish** (or extend `OMEGA_ITERATIONS`). Watch the
   fleet slices in the Elo log. If they climb above random and PROMOTEs accumulate,
   Path B is working.
2. **If it plateaus below Class II:** raise `OMEGA_SEARCH_ITERS` (e.g. 240–320) for
   sharper/stronger targets, and/or accumulate data across iterations (a replay
   buffer — currently each iteration collects fresh and overwrites
   `tools/nn/data/omega-trajectories.jsonl`).
3. **Once it beats Class II at fleet sizes:** run the promotion checklist below.
4. **Then (optional) go pure (Path A):** once the value head is competent, switch
   `omegaSearchVisits(..., { leaf: 'value' })` (see `omega-search.ts`) to drop
   heuristic rollouts — the AlphaGo→AlphaZero graduation. Plumbing already supports it.

### Promotion checklist (when Ω clears Class II broadly, ~+300 implied Elo)
- Add an `omega` entry to `AI_OPPONENT_TEI_POINTS` / `AI_OPPONENT_TEI_GO_OUT` in `libs/tei-core/src/stats-elo.ts` (provisional ~1700 points).
- Flip `apps/Warp12/src/game/local-ai-match-validation.ts`: stop rejecting Class Ω matches, rate them against the new anchor.
- Wire `createOmegaPlayer` into the client game config as a selectable tier (mirror how `createClass1StarPlayer` is wired).
- Update `RULES.md` / `docs/tei-spec.md` (currently Ω is reserved as experimental/unrated).

---

## Maximum-strength program (north star: strongest MTD competitor ever)

**Directive:** build the strongest Mexican Train player in the world, whatever it
takes. **Inference budget approved: seconds up to ~1 minute per move.** That is a
large budget and it reshapes the plan — the strongest player is the **net guiding
search at inference**, not the bare distilled net.

### The key insight
A distilled net can only be as strong as the search targets it learned from — it
caps at "search strength," then plateaus. That is ideal for a *fast rated tier*
(instant moves) but is **not** the strongest possible player. AlphaGo beat Lee
Sedol with MCTS+net, not the policy net alone. Two tiers:

- **Rated / product tier** = fast distilled net (`createOmegaPlayer`). Milliseconds/move. What the current training run builds.
- **Championship tier** = net-guided ISMCTS at play time, big budget (seconds–1 min/move). The monster for exhibition/Kasparov matches. Exceeds the bare net.

With a ~1-minute budget we can also stand up a **strong search opponent right now**
using `omegaSearchVisits(obs, net, { leaf:'heuristic', iterations: <thousands> })`
(Commander-rollout ISMCTS scaled up — essentially Fleet Admiral with a much larger
budget) as an interim champion while the net trains.

### Strength levers, in priority order
1. **Raise search-target quality** (ceiling lever for the distilled net):
   `OMEGA_SEARCH_ITERS` 160 → 320+, tighter belief constraints. Stronger targets →
   stronger net → stronger everything. Cheap, high impact.
2. **Net-guided search at inference = the champion.** Add a **PUCT policy prior** to
   `ismcts.ts` (currently plain UCT) so the policy net focuses the search and the
   value net evaluates leaves. Run it with a large per-move budget (seconds–1 min).
   This is the one meaningful piece of new search engineering left, and it is what
   produces the strongest player. Wire a `createOmegaSearchPlayer` (a `WarpAiPlayer`
   that returns the argmax-visit move from `omegaSearchVisits`) for live play.
3. **AlphaZero flywheel (Path A).** Switch search leaf to the value net
   (`leaf:'value'`) once the value head can concentrate → the net improves the
   search that trains the net. No ceiling, no Commander. Prereq: a competent value head.
4. **Hand-size-bucket specialists** (2–4 / 5–6 / 7–8 tiles), **fine-tuned from the
   generalist** (not from scratch) — squeezes per-regime strength for both tiers.
   Do this once the generalist clears Class II. Route by table size at inference.
   Trigger: persistent per-slice interference (some fleet slices won't rise while
   others do), not one noisy candidate.
5. **Scale net + data** once signal quality is high (capacity is not the current
   bottleneck — `policy_top1≈0.94`).

### Execution order for whoever continues
Generalist distillation (running) → confirm it lifts fleet play above random →
crank search-target iters → add PUCT prior + `createOmegaSearchPlayer` for the
championship tier → Path A flywheel → bucket specialists → exhibition match.

---

## Gotchas / hard-won lessons (do not relearn these)

- **macOS system bash is 3.2** — no empty-array expansion under `set -u`; the gate
  script exits 10 to signal "promote" and is shielded with `set +e`. Don't "simplify"
  those without testing on 3.2.
- **`date +%s` is aliased** in this shell (prints a BrightDate error). Use bash
  `SECONDS` for timing.
- **ONNX export** uses the modern `dynamo=True` + `.save(external_data=False)` for a
  single self-contained file (needs `onnxscript`, pinned in `tools/nn/requirements.txt`).
  The `torchvision not installed` log lines are harmless (we export plain MLPs).
- **ONNX is not the critical path** — `omega-v1.json` (TS fallback) is authoritative
  for the agent and bench.
- **Credit assignment matters most.** Labeling decisions by *final campaign winner*
  is near-noise; label by **per-round graded rank reward** (in `collect-omega-trajectories.ts`,
  `recordRoundRewards`/`rankRewards`). This was the single biggest unlock at 2p.
- **Value-net-guided ISMCTS cold-starts to uniform targets** (weak value net can't
  concentrate). That's why we use heuristic rollouts (Path B) to bootstrap.
- **REINFORCE is unstable here** — needs advantage standardization + champion gating.
  Cross-entropy against visit targets (Path B) is much more stable; prefer it.
- **Don't add layers** — `policy_top1≈0.94` shows ample capacity; the bottleneck was
  always signal quality, not model size.

---

## Key files

| Path | Role |
|------|------|
| `libs/engine/src/lib/ai/omega-net.ts` | Two-head policy/value MLP (forward, zero-init, validate) |
| `libs/engine/src/lib/ai/omega-encoder.ts` | 303-dim policy + 195-dim state features |
| `libs/engine/src/lib/ai/omega-agent.ts` | `createOmegaPlayer` — opaque `WarpAiPlayer` |
| `libs/engine/src/lib/ai/omega-search.ts` | ISMCTS wrapper: `leaf:'heuristic'` (Path B) / `'value'` (Path A) |
| `libs/engine/src/lib/ai/collect-omega-trajectories.ts` | Self-play collector: per-round rewards, mixed tables, search targets |
| `libs/engine/src/lib/ai/collect-omega-parallel.ts` + `collect-omega.worker.ts` | Parallel sharded collection |
| `libs/engine/src/lib/ai/bench-omega.ts` | Ω vs Commander eval gate |
| `tools/nn/train-omega.py` | PyTorch trainer (MPS, vectorized; CE for search groups, REINFORCE fallback) |
| `tools/nn/collect-omega-trajectories.ts` / `bench-omega.ts` | CLI drivers |
| `scripts/omega-train-loop.sh` | Champion-gated loop |
| `tools/nn/data/omega-elo-log.jsonl` | Progress log |
| `tools/nn/data/omega-2p-champion.json` | Archived 2p specialist (parity w/ Commander) |
| `package.json` | `omega:collect`/`train`/`bench`/`loop` scripts |

## Scripts
```bash
yarn omega:collect     # one collection (honors OMEGA_* env)
yarn omega:train       # train from scratch;  omega:train:warm = --init champion
yarn omega:bench       # Ω vs Commander sweep (OMEGA_BENCH_PLAYERS)
yarn omega:loop        # the gated collect→train→bench loop (scripts/omega-train-loop.sh)
```
