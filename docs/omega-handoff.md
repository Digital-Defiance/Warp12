# Class Ω — Hand-off Status (READ FIRST)

**For:** the next assistant/engineer (Cursor et al.) picking this up.
**Date:** 2026-07-08 (updated from 2026-07-07).
**Deep design + roadmap:** [`omega-next-steps.md`](./omega-next-steps.md) (read after this).
**TEI integration:** [`tei-spec.md`](./tei-spec.md) §2.2, §7.1.3.

---

## TL;DR

**Class Ω is shipped as Class II.** Greedy `createOmegaPlayer` replaces the heuristic
Commander officer for `skill: 'commander'` (local, pass-and-play, online host).
Points + go-out use separate weight files under `apps/Warp12/public/models/`.

**Ω+** is **extended thinking** — the
**same weights** with **Commander-free** PUCT search at inference (Omega policy
prior + value leaves; seconds/move). Exhibition / hard mode, not a second
training pipeline. Heuristic-leaf search remains a **training bootstrap** only
(Path B). BENCHED: PUCT @ ~480 iters beats greedy Ω (~1.3× fair share on go-out 4p);
deeper search currently **hurts** until Path A strengthens the value head.

**Advisor:** a **hybrid neural–heuristic concept model** trained to agree with Ω’s
picks and explain them in named terms (`WARP_HEURISTIC_IDS`). Target Ω’s
decisions, **not** legacy Commander heuristics (avoid the Class I\* imitation trap).

**TEI:** humans keep **two ratings** (points + go-out), not eight. Class II stays
the σ=`commander` anchor **key**. **Next:** publish `warp12-official-v2` with
**recalibrated** `REF_TEI(T, commander)` so ~50% win rate holds vs neural Class II —
stored human TEI integers are not re-banded.

**Online (Firebase):** AI runs on the **sector host’s client**, not Cloud Functions.
Host proxies AI moves through Firestore; Ω weights load from Hosting static assets
on the host device (`useHostAiRunner` → `buildAiRosterFromConfigsAsync`).

---

## Where things stand (honest status — 2026-07-08)

| Milestone | Status |
|-----------|--------|
| Pipeline (collect → train → bench → gate loop) | ✅ built |
| Points generalist champion | ✅ ships as `public/models/omega-v1.json` |
| Go-out champion | ✅ ships as `public/models/omega-goout-v1.json` |
| **Class II = greedy Ω** (local + online host + pass-and-play) | ✅ wired (`skill: 'commander'` → `createOmegaPlayer`) |
| Practice-AI replay (Functions) loads Ω weights | ✅ staged under `functions/models/` |
| Distilled explainable advisor | ⬜ designed, not built |
| Ω+ PUCT (Commander-free) | ✅ code ready (`createOmegaSearchPlayer`, leaf=`puct`); UI exhibition toggle not shipped |
| Path A value-head retraining | ⬜ next training lift for Ω+ that scales with search depth |
| TEI `warp12-official-v2` REF_TEI recalibration | ⬜ still using heuristic Class II constants — **do soon** |

**TEI note:** Class II play is neural Ω. `warp12-official-v2` ships with
`REF_TEI(T, commander)` = **1520 points / 1550 go-out** (tempered for 2–4p
solo play after full 2–8p benches). Human stored TEI integers are not re-banded.

**Latest numbers** (`tools/nn/data/omega-elo-log.jsonl`, Jul 5): champion mean
fair-share **1.4188** (beats legacy Commander at large tables; ~1.0–1.2 at 3p/4p).
Gate metric = mean `fairShareRatio` across bench slices (1.0 = parity with legacy
Commander). **Do not trust “in progress / steady PROMOTEs”** — the run plateaued;
use the log and file timestamps, not stale narrative.

```python
# Check the log
import json
for r in (json.loads(l) for l in open('tools/nn/data/omega-elo-log.jsonl') if l.strip()):
    s={f"{x['playerCount']}p":round(x['fairShareRatio'],2) for x in r['slices']}
    print(r['iteration'], r['decision'], r.get('candidateScore'), r.get('championScore'), s)
```

---

## Architecture (target — no Commander+, no 28 nets)

```
                    ┌─────────────────────────────────────┐
                    │  Class II officer (replaces Commander) │
                    │  σ = commander · rated default       │
                    │  createOmegaPlayer — greedy Ω net      │
                    └─────────────────────────────────────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    ▼                                   ▼
         ┌──────────────────────┐         ┌──────────────────────────┐
         │  Ω+ extended thinking │         │  Tactical advisor         │
         │  same Ω weights       │         │  concept-bottleneck net   │
         │  + ISMCTS / PUCT      │         │  distilled to match Ω     │
         │  seconds–min / move   │         │  explains in plain terms  │
         │  unrated / exhibition │         │  (assisted = unrated)     │
         └──────────────────────┘         └──────────────────────────┘
```

| Asset | Count | Notes |
|-------|-------|-------|
| Ω policy/value net | **1** (≤**2** if points/go-out won’t share) | Encoder sees objective, player count, hand size |
| Advisor concept net | **1** | Trained on Ω labels + engine concept supervision |
| Ω+ | **0** extra weights | Extended thinking = inference mode only |
| Per-table-size nets | **0** unless forced | `playerCount` is already a feature |

**Training north star:** promote when candidate beats **current Ω champion** on
target slices — not “beat legacy Commander everywhere.” Commander heuristics remain
useful only as **Path B rollout leaves** during bootstrap; drop them in Path A.

---

## Online play (Firebase)

- AI officers (Class IV / III / II) already work online: host adds seats, picks skill,
  host client runs `useHostAiRunner` → `buildAiRosterFromConfigs` → submits moves.
- Firestore rules allow the **host** to read AI hands and proxy AI actions.
- **Ω swap requires:** `useHostAiRunner` → `buildAiRosterFromConfigsAsync` so the
  host preloads `omega-v1.json` once per sector (~5 MB from Hosting).
- **Ω+ online:** same host-client constraint — long search blocks all players;
  ship exhibition-only until host-transfer or server inference is explored.

---

## Current training recipe (when restarting)

```bash
OMEGA_ITERATIONS=30 \
OMEGA_GAMES=500 \
OMEGA_PLAYERS="8" \
OMEGA_SEARCH_ITERS=480 \
OMEGA_OBJECTIVE=points \
OMEGA_EPOCHS=8 \
OMEGA_BATCH=1024 \
OMEGA_BENCH_GAMES=120 \
OMEGA_BENCH_PLAYERS="8" \
OMEGA_WORKERS=15 \
OMEGA_ELO_LOG=tools/nn/data/omega-elo-log.jsonl \
bash scripts/omega-train-loop.sh
```

Start **8p-only** until that slice is solid, then widen to 3–8p and add go-out.
Raise `OMEGA_SEARCH_ITERS` before splitting into per-N specialists.

**Gate:** champion vs champion on chosen slices; require green `yarn test:engine`
before promotion. Use `OMEGA_GATE_METRIC=weighted` with `OMEGA_GATE_WEIGHTS` when
mean gate rejects candidates that fix weak slices (e.g. go-out 4p/5p). Set
`OMEGA_GATE_REBASE=1` once when switching gate metric to re-bench the champion.

---

## Promotion checklist (replace Class II, not add Ω tier)

1. **Bench** — candidate beats champion on agreed slices (8p first, then fleet + go-out).
2. **Engine** — `yarn test:engine` green (conformance + fuzz + invariants).
3. **Wire play** — `skill: 'commander'` → `createOmegaPlayer` in `buildAiRosterFromConfigs` (local, pass-and-play, **online host** via async roster).
4. **TEI v2** — ship `warp12-official-v2`; recalibrate `REF_TEI(T, commander)` to ~50% win rate vs greedy Ω (expect ~1650–1700); human stored TEI unchanged.
5. **Advisor v1** — post-hoc heuristic attribution on Ω picks (quick), then concept-bottleneck net trained on Ω agreement (real explanations).
6. **Ω+** — `createOmegaSearchPlayer` + PUCT prior; exhibition / casual only until calibrated.

**Do not** add a separate `REF_TEI(T, omega)` band if Ω *is* Class II. One anchor
key, recalibrated constants, new rules profile version.

---

## Ω+ = extended thinking

Same `omega-v1.json` weights. At each decision, run `omegaSearchVisits` with a
real time/iteration budget (PUCT policy prior + value leaves when Path A is ready).
Strongest practical player; slower. **Not** a separate training run or TEI tier.

Interim: scale up `omegaSearchVisits(..., { leaf:'heuristic', iterations: N })` while
the value head matures. Ship as optional “extended thinking” in UI.

---

## Advisor: hybrid neural–heuristic (distilled from Ω)

**Goal:** suggest the **same move Ω would play** (or close), explain **why** in
named concepts — not imitate legacy Commander.

| Phase | Approach |
|-------|----------|
| **A (ship first)** | Ω picks; `explainWarpAiAction` narrates heuristics on that move. Label: approximate rationale. |
| **B (target)** | Concept layer (~20 named scalars from engine facts) → scoring head; train scoring on **Ω move labels**; concepts supervised from state. Real bottleneck explanations. |

**Never** train the advisor target on Commander picks (Class I\* failure mode).

---

## Maximum-strength levers (priority)

1. **Stronger distillation targets** — `OMEGA_SEARCH_ITERS` 320→480+; Path A value leaves when ready.
2. **Ω+ at inference** — PUCT + `createOmegaSearchPlayer` (extended thinking).
3. **8p-first champion loop** — then fleet + go-out in one generalist net.
4. **Advisor distill** — concept net agrees with Ω on held-out states.
5. **Hand-size bucket fine-tunes** — only if 3p/4p won’t rise after 1–4 (last resort).

---

## Gotchas (still true)

- **Fair-share, not raw win rate** at N>2: `fairShareRatio = winRate ÷ (1/N)`.
- **Per-round credit** for points campaigns — campaign-winner labels are noise.
- **Path B** uses Commander only as rollout leaf; shipped net has no Commander at inference.
- **macOS bash 3.2** — gate script `set +e` around promote exit 10.
- **Docs drift** — trust `omega-elo-log.jsonl` + model file mtimes over narrative.
- **Legacy Commander bench** — bootstrap metric only; not the training north star.

---

## Key files

| Path | Role |
|------|------|
| `libs/engine/src/lib/ai/omega-agent.ts` | `createOmegaPlayer` — fast Class II target |
| `libs/engine/src/lib/ai/omega-search.ts` | Ω+ extended thinking (`omegaSearchVisits`) |
| `libs/engine/src/lib/ai/explain-action.ts` | Heuristic explanations (advisor phase A) |
| `libs/engine/src/lib/ai/heuristics.ts` | `WARP_HEURISTIC_IDS` — advisor concept vocabulary |
| `libs/engine/src/lib/engine/mexican-train-conformance.spec.ts` | Engine verification (MT-Compliance) |
| `libs/engine/src/lib/engine/random-play-harness.ts` | Fuzz + invariants |
| `apps/Warp12/src/app/use-host-ai-runner.ts` | Online AI on host client (needs async Ω load) |
| `tools/nn/data/omega-elo-log.jsonl` | Training progress (source of truth) |
| `docs/tei-spec.md` | TEI + ladder extensibility + Class II replacement |

## Scripts

```bash
yarn test:engine          # gate before any promotion
yarn omega:collect        # OMEGA_* env
yarn omega:train:warm     # warm-start from champion
yarn omega:bench          # vs legacy Commander (bootstrap metric only)
yarn omega:loop           # scripts/omega-train-loop.sh
```
