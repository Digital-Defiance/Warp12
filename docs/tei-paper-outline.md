# TEI, Self-Play Calibration, and Dual-Objective AI for Mexican Train

**Working title (conference):** *Self-Play Calibration of Heuristic Agents for Mexican Train Under Competing Objectives*

**Working title (white paper):** *Designing TEI: Skill Rating and AI Tiers for Warp 12 / Mexican Train*

**Status:** Outline + draft notes — not submission-ready.

---

## Abstract (draft)

Mexican Train dominoes is commonly played under two incompatible victory conditions: **penalty** (lowest pip total when the round ends) and **go-out** (first player to empty their hand). We describe Warp 12’s **Tactical Effectiveness Index (TEI)** — a dual-track Elo-style rating anchored to fixed AI reference tiers — and the **self-play calibration pipeline** used to validate Class IV–II AI officers against those bands. Agents combine interpretable heuristics, optional determinized lookahead, and a rules-faithful engine (Distress Beacons, Red Alert, Neutral Zone, modules, house rules). Empirical calibration shows that **skill ordering is stable and aligns with reference TEI spacing under penalty**, while **go-out compresses implied skill gaps** due to race variance — especially in heads-up Class III vs Class II matchups and at higher table sizes. We argue for **percentile-augmented leaderboards**, **objective-specific search depth**, and **runtime house-rule gating** instead of per-variant weight matrices. We contrast this deployable stack with what would be required for superhuman (“Deep Blue–class”) Mexican Train play.

---

## 1. Introduction

### 1.1 Motivation
- Mexican Train is widely played but under-studied in game AI literature.
- Two win conditions create two different strategic games on the same table.
- Online play needs interpretable skill measurement and fair AI opponents.
- Coaching/advisor tools must not contaminate competitive ratings.

### 1.2 Contributions
1. **Dual-track TEI** — independent penalty and go-out ratings with fixed reference AI bands.
2. **Engine-faithful heuristic agents** — legal moves, modules, and house rules from the same code path as human play.
3. **Self-play calibration methodology** — tier-vs-tier matrix + multi-player focus matchups + optional coordinate-search weight tuning.
4. **Empirical comparison of objectives** — penalty calibrates cleanly; go-out is high-variance.
5. **Product constraints as design** — advisor disqualification, baked-in lookahead tiers, percentile boards.

### 1.3 Warp 12 terminology map
| Player-facing | Internal / engine |
|---------------|-------------------|
| Captain (seat) | `PlayerId` |
| TEI | Elo-style rating displayed to humans |
| Tactical Class IV–II | `ensign` / `lieutenant` / `commander` skill presets |
| Class I | Human prestige only (not AI tier) |

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

| Dimension | Penalty | Go-out |
|-----------|---------|--------|
| Win condition | Lowest pips at round end | First empty hand |
| Horizon | Multi-round campaign (1–13) | Often single-round race |
| Core skill | Pip shedding, blocking, flexibility | Tempo, connectivity, mayhem |
| Variance | Lower | Higher |
| Search benefit | Modest (2p tests showed noise) | Helpful at 2p; chaotic at 3+ |
| Reference TEI spacing | 200 pts / tier | 250 pts / tier |

---

## 4. Agent architecture

### 4.1 Policy stack
- Candidate generation from legal moves + special actions.
- Weighted heuristic scoring + temperature + blunder rate.
- Optional determinized lookahead: sample hidden hands consistent with counts → forward simulate in engine.

### 4.2 Skill presets (Class IV–II)
- **Penalty presets:** pip dump, trail pressure, Red Alert safety, Q timing.
- **Go-out presets:** sprint heuristics (`goOutWin`, `goOutFeasibility`, block leader, avoid mayhem, …).
- Separate `goOutTuning` thresholds per tier.

### 4.3 Lookahead policy (product decision)
- Lookahead **baked into tier**, not user-toggle — keeps TEI comparable across clients.
- Class II go-out: depth 2 at **2 players only**; greedy at 3+.
- Class II penalty: greedy at all sizes (search hurt calibration in 2p tests).

### 4.4 Tactical advisor
- Class II profile, blunder rate 0, lookahead on.
- Explainability: `explainWarpAiAction`, turn-resolution hints.
- **Unassisted-only TEI** — advisor use tracked separately.

---

## 5. TEI (Tactical Effectiveness Index)

### 5.1 Reference bands
Fixed opponent TEI for unassisted matches:

| Track | Class IV | Class III | Class II |
|-------|----------|-----------|----------|
| Penalty | ~1000 | ~1200 | ~1400 |
| Go-out | ~1000 | ~1250 | ~1500 |

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

### 7.1 Penalty (default rules, 200 games/matchup)
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

---

## 8. Discussion

### 8.1 What calibration teaches
- **Penalty** behaves like a smooth skill ladder — good fit for fixed TEI spacing.
- **Go-out** behaves like a stochastic race — ordering survives, magnitudes don’t.
- **Table size** erodes heads-up skill signal — focus tests essential.
- **House rules** mostly reshape legality — heuristics gated at runtime suffice for DTI.

### 8.2 Design recommendations
- Never merge penalty and go-out TEI.
- Show percentile on go-out boards.
- Don’t expose lookahead as a rating-affecting toggle.
- Retune weights selectively (popular hosted configs), not full combinatorial grid.

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
| Stable objective | Penalty *or* go-out (different games) |
| Minimax sound | No single “optimal” line vs N−1 opponents |
| Endgame databases | Stochastic draw chain; round recycle |

**Conclusion:** There is no analogous “proof” or full tablebase. Superhuman MT means **strong belief-state play under uncertainty**, not brute-force enumeration.

### 9.2 What “Deep Blue class” would mean operationally

A reasonable definition for Mexican Train:

1. **Beat the best known human specialists** consistently across both objectives.
2. **Robust across table sizes** (2–8) and common house-rule bundles.
3. **Exploits imperfect-information inference** — hand range modeling, draw equity.
4. **Demonstrably above Class II** with statistical significance (not just +50 Elo — +300+ implied gap vs current Class II).
5. **Reproducible** — documented training, open benchmarks.

### 9.3 Gap from current Warp 12 stack

| Layer | Today (Class II) | Deep Blue class |
|-------|------------------|-----------------|
| Policy | Weighted heuristics + blunder model | Learned policy or CFR blueprint |
| Search | Depth-2 determinized lookahead (2p go-out only) | ISMCTS / continual re-planning every turn |
| Belief state | Random consistent hand samples | Bayesian / particle beliefs over opponent hands + pile |
| Training | ~150–200 game calibration + small coordinate search | Millions–billions of self-play trajectories |
| Multi-player | Greedy tier heuristics + focus tests | Equilibrium approximation (e.g. NFSP, PSRO) |
| Compute | Laptop minutes | GPU cluster weeks/months |
| Verification | Self-play tier ordering | Human champion matches + ablation studies |

**Rough effort:** not a feature sprint — a **multi-year research program** with specialized team (engine + ML + domain expert + UX).

### 9.4 Staged roadmap (if pursued)

#### Phase 0 — Benchmark (3–6 months)
- Freeze ruleset + house-rule profiles for research.
- Publish reproducible harness (already mostly exists: `warp12-engine` self-play).
- Recruit / identify strong human players; run Class II vs human study.
- Establish baseline win rates by objective and player count.

#### Phase 1 — Strong ISMCTS (6–12 months)
- Information-set MCTS on existing engine (belief determinization → playout).
- No neural net yet; outplay Class II by search volume alone at 2–4 players.
- **Deliverable:** “Class I” engine tier stronger than current commander.

#### Phase 2 — Learned value / policy (1–2 years)
- Collect self-play dataset from Phase 1 + heuristic agents.
- Train policy/value net on `(public state, belief features) → action/value`.
- Hybrid: net guides MCTS rollouts (AlphaZero-style, scaled down).
- Separate heads or models for **penalty vs go-out** (critical).

#### Phase 3 — Multi-player equilibrium (research frontier)
- 3+ players: optimize for **utility / placement** not pure win rate.
- Techniques: PSRO, NFSP, or simplified 3-player subgames.
- May need to define “optimal” as **maximize expected campaign score** (penalty) or **win probability** (go-out).

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

Deep Blue depth trades away explainability, build cost, and mobile feasibility.

### 9.6 Intermediate wins (high ROI, pre–Deep Blue)

1. **Class I heuristic tier** — hand-tuned commander++ without ML.
2. **ISMCTS advisor mode** — stronger coach, still explainable from search lines.
3. **Opening book** for round 1 given spacedock value + hand — cheap lift for penalty.
4. **Human dataset** — log anonymized online games for future training.
5. **Published benchmark** — “MT-Bench”: fixed seeds, rules profile, expected win rates.

---

## 10. Conclusion

TEI and self-play calibration provide a **practical, honest skill ladder** for a game too messy for classical solving. Penalty and go-out should be treated as **two calibration targets** on one engine. Superhuman Mexican Train is feasible as a **research program** (belief-state search + learning + human validation), not as an extension of current heuristic weight tuning — but it is also **not required** for an excellent commercial and competitive experience.

---

## Appendix A — Figure list (planned)

1. Architecture diagram: UI → engine → AI policy → TEI update.
2. Calibration matrix heatmap (higher-skill win rates).
3. Penalty vs go-out implied ΔTEI comparison bars.
4. 4-player focus win rate vs random baseline by table size.
5. Example position where penalty and go-out best moves diverge.

## Appendix B — Code map

| Concern | Location |
|---------|----------|
| Skill presets | `libs/engine/src/lib/ai/skill.ts` |
| Heuristics | `libs/engine/src/lib/ai/heuristics.ts` |
| Self-play | `libs/engine/src/lib/ai/self-play.ts` |
| Calibration | `libs/engine/src/lib/ai/ai-elo-calibration.ts` |
| Optimizer | `libs/engine/src/lib/ai/ai-weight-optimizer.ts` |
| Human TEI update | `Warp12-leaderboard/src/firebase/stats-elo.ts` |
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

*Generated for Warp 12 / Digital Defiance — living document; paste fresh calibration output into §7 before submission.*
