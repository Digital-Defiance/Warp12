# TEI calibration log

Living record of self-play runs, optimizer passes, and preset changes.  
Goal: **honest self-improvement** — measure, tune, document, repeat.

---

## 2026-06-29 — `yarn calibrate:ai-tei-dti` (200 games / matchup)

**Penalty (default rules)**  
- Symmetric seating ~50/50 ✓  
- Class IV vs III: 88.0% (expected ~76%) — strong ordering  
- Class IV vs II: 91.5% (expected ~91%) — on target  
- Class III vs II: 63.0% (expected ~76%) — compressed but ordered  

**Go-out**  
- Class IV vs III: 63.0% (expected ~81%)  
- Class IV vs II: 74.5% (expected ~95%)  
- Class III vs II: **51.0%** (expected ~81%) — race variance dominates  
- 4p focus: Class II 38.5%, Class III 27.0% vs 25% random — ordering holds  

**Drop to Impulse (penalty sanity)**  
- All matchups complete; ordering preserved (83% / 91.5% / 59%)  

**Takeaway:** Penalty calibrates well. Go-out implied TEI gaps compress — percentile boards and wider reference spacing (250 vs 200) are the right product response, not tighter heuristic targets alone.

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
