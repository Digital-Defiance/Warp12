# Comprehensive Luck vs Skill Study Across All Warp Factors
## Publication-Quality Experimental Design

**Goal:** Quantify skill ceiling degradation across domino set sizes (Warp 1–18+) and fleet sizes (2–maxFleet) with statistical rigor suitable for peer-reviewed publication.

---

## 1. Experimental Design

### 1.1 Independent Variables

**Factor 1: Warp Factor (Domino Set Size)**
- **W1** (double-blank, 1 tile) — degenerate baseline
- **W3** (double-three, 10 tiles) — minimal viable
- **W6** (double-six, 28 tiles) — "standard dominoes"
- **W9** (double-nine, 55 tiles)
- **W12** (double-twelve, 91 tiles) — **IWGF rated**
- **W15** (double-fifteen, 136 tiles)
- **W18** (double-eighteen, 190 tiles)
- *(Optional: W21, W24 if engine supports)*

**Factor 2: Fleet Size (Player Count)**
- **Each Warp Factor:** 2 players → maxFleet (per deal rules)
  - W1-W3: 2p only (insufficient tiles)
  - W6: 2–4 players
  - W9: 2–6 players
  - W12: 2–8 players (official maximum)
  - W15: 2–10 players
  - W18: 2–18 players (theoretical maximum)

**Factor 3: Objective**
- **Points** (primary analysis)
- **Go-out** (secondary, if resources permit)

### 1.2 Dependent Variables (Metrics)

**Primary Metrics (per-game aggregates):**
1. `avgLegalMoves` — branching factor
2. `avgUniqueTrains` — train availability
3. `avgConstrainedTileFraction` — single-train constraint %
4. `avgUniquePips` — hand diversity
5. `avgMaxCluster` — pip clustering ability
6. `avgHandEntropy` — Shannon entropy (bits)
7. `avgMoveValueSpread` — best - worst move pips
8. `avgNearOptimalFraction` — % moves within 90% of best
9. `avgOwnTrailPlayRate` — strategic planning %
10. `avgShieldsDownRate` — blocking frequency %

**Derived Metrics:**
- **Skill Index** (0-4): Count of indicators exceeding thresholds
  - High constraints (>50%)
  - Low entropy (<3.0 bits)
  - Wide spread (>15 pips)
  - High own-trail (>40%)

**Skill Sensitivity (validation):**
- Commander vs Ensign win rate delta (Δ from 1/N baseline)

### 1.3 Sample Sizes (Publication Standards)

**Per configuration (Warp factor × fleet size × objective):**
- **Metrics collection:** 500 games (sufficient for stable aggregates)
- **Skill sensitivity:** 1000 games (detect ≥3pp win rate differences with α=0.05, power=0.80)

**Estimated total games:**
- W1-W3: 2 configs × 500 = 1,000
- W6: 3 configs × 500 = 1,500
- W9: 5 configs × 500 = 2,500
- W12: 7 configs × 500 = 3,500
- W15: 9 configs × 500 = 4,500
- W18: 17 configs × 500 = 8,500
- **Total (points only):** ~22,000 games
- **With go-out:** ~44,000 games

**Skill sensitivity subset (10 key configs × 1000g):** 10,000 games

**Grand total:** ~54,000 games for full study

---

## 2. Hypotheses

### H1: Monotonic Skill Degradation with Set Size
At fixed fleet size (e.g., 4p), skill index decreases monotonically from W6 → W18.

**Prediction:**
- W6 @ 4p: Skill index = 4/4
- W9 @ 4p: 3-4/4
- W12 @ 4p: 3-4/4 (**empirical baseline**)
- W15 @ 4p: 2-3/4
- W18 @ 4p: 0-2/4

### H2: Monotonic Skill Degradation with Fleet Size
At fixed Warp factor (e.g., W12), skill index decreases monotonically from 2p → maxFleet.

**Prediction (W12):**
- 2p: 4/4
- 4p: 3-4/4
- 6p: 2-3/4
- 8p: 0-2/4

### H3: Interaction Effect
Skill degradation accelerates with both factors: W18 @ 18p is purely luck-dominated (0/4), while W6 @ 2p is maximally skill-dominated (4/4).

### H4: Skill Sensitivity Correlation
Skill index (0-4) correlates strongly (r > 0.7) with Commander win rate delta (% above 1/N baseline).

**Prediction:**
- 4/4 configs: Δ ≥ +15pp
- 2/4 configs: Δ ≈ +5-10pp
- 0/4 configs: Δ < +3pp

### H5: W9 vs W12
W9 @ 4p has equal or higher skill index than W12 @ 4p (smaller sets are tighter games).

---

## 3. Experimental Protocol

### 3.1 Infrastructure Requirements

**Engine modifications:**
1. ✅ Metrics collection already implemented (`luck-skill-metrics.ts`)
2. ✅ Self-play harness supports arbitrary maxPip (`playSelfPlayGame`)
3. ⚠️ Need multi-Warp-factor Omega models (or use Commander heuristics)
4. ⚠️ Need deal rules for W1-W3, W15, W18+ (hand sizes)

**Decision:** Use **Commander heuristics** (not Omega) for all Warp factors. This:
- Ensures consistent policy across all sets
- Avoids training 7 separate Omega models (expensive)
- Tests skill ceiling of the *game*, not AI training difficulty

**Commander suitability:** Commander heuristics (pip dump, trail pressure) transfer reasonably across Warp factors—the analysis tests game structure, not superhuman play.

### 3.2 Implementation Steps

#### Step 1: Extend Deal Rules

Add to `libs/engine/src/lib/constants/setup.ts`:

```typescript
export function getHandSize(maxPip: number, playerCount: number): number {
  // Standard multi-trail hand sizing across all Warp factors
  if (playerCount <= 4) return 15;
  if (playerCount <= 6) return 12;
  if (playerCount <= 8) return 10;
  // Extended for large sets
  if (playerCount <= 12) return 8;
  return 6; // 13+ players (W18 only)
}

export function getMaxFleetSize(maxPip: number): number {
  const tiles = ((maxPip + 1) * (maxPip + 2)) / 2;
  if (maxPip <= 3) return 2; // Not enough tiles
  if (maxPip <= 6) return 4;
  if (maxPip <= 9) return 6;
  if (maxPip <= 12) return 8;
  if (maxPip <= 15) return 10;
  return Math.min(18, Math.floor(tiles / 6)); // At least 6 tiles/hand
}
```

#### Step 2: Batch Collection Script

Create `tools/nn/collect-luck-skill-comprehensive.ts`:

```typescript
import { writeFileSync } from 'node:fs';
import { benchOmegaVsCommander } from '../../libs/engine/src/lib/ai/bench-omega.ts';
import { createWarpAiPlayer } from '../../libs/engine/src/lib/ai/create-warp-ai.ts';
import { runSelfPlayMatch } from '../../libs/engine/src/lib/ai/self-play.ts';
import { getMaxFleetSize } from '../../libs/engine/src/lib/constants/setup.ts';

const WARP_FACTORS = [3, 6, 9, 12, 15, 18];
const GAMES_PER_CONFIG = 500;
const OBJECTIVE = 'points';

const results = [];

for (const maxPip of WARP_FACTORS) {
  const maxFleet = getMaxFleetSize(maxPip);
  
  for (let playerCount = 2; playerCount <= maxFleet; playerCount++) {
    console.error(`\n=== Warp ${maxPip}, ${playerCount}p ===`);
    
    // Use Commander self-play with metrics
    const seats = Array.from({ length: playerCount }, (_, i) => ({
      id: String.fromCharCode(97 + i),
      displayName: `Commander-${i}`,
      player: createWarpAiPlayer({
        skill: getWarpSkillProfile('commander', OBJECTIVE, playerCount),
        objective: OBJECTIVE,
        lookahead: resolveWarpLookahead('commander', OBJECTIVE, playerCount),
        rng: mulberry32(9001 + i),
      }),
    }));
    
    const result = runSelfPlayMatch(
      (gameIndex) => seats,
      {
        games: GAMES_PER_CONFIG,
        seed: 9001,
        objective: OBJECTIVE,
        maxPip,
        collectMetrics: true, // <<< KEY FLAG
      }
    );
    
    // Aggregate metrics across games
    const gameMetrics = result.games
      .map(g => g.metrics)
      .filter(Boolean);
    
    const summary = summarizeLuckSkillMetrics(
      gameMetrics,
      playerCount,
      maxPip,
      OBJECTIVE
    );
    
    results.push({
      maxPip,
      playerCount,
      objective: OBJECTIVE,
      games: GAMES_PER_CONFIG,
      ...summary,
    });
    
    console.error(`  Skill index: ${computeSkillIndex(summary)}/4`);
  }
}

writeFileSync(
  'tools/nn/data/luck-skill-comprehensive.json',
  JSON.stringify(results, null, 2)
);

console.error('\n✓ Collection complete. Results saved.');
```

#### Step 3: Skill Sensitivity Validation

Create `tools/nn/validate-skill-sensitivity.ts`:

```typescript
// For key configs, run Commander vs Ensign
const KEY_CONFIGS = [
  { maxPip: 6, playerCount: 4 },
  { maxPip: 9, playerCount: 4 },
  { maxPip: 12, playerCount: 4 },
  { maxPip: 12, playerCount: 8 },
  { maxPip: 15, playerCount: 4 },
  { maxPip: 18, playerCount: 4 },
  { maxPip: 18, playerCount: 18 },
];

const SENSITIVITY_GAMES = 1000;

for (const config of KEY_CONFIGS) {
  // Run Commander vs Ensign (seats rotated)
  // Measure win rate delta from 1/N baseline
  // Save to tools/nn/data/skill-sensitivity.json
}
```

### 3.3 Compute Requirements

**Single-threaded estimates:**
- W12 @ 4p: ~100ms/game
- Full study: 54,000 games × 100ms = 5,400s = **1.5 hours**

**With parallelization (15 workers):**
- ~6-10 minutes for full study

**Storage:**
- Per-game metrics: ~2KB/game × 54,000 = 108MB raw
- Aggregated results: ~50KB JSON

---

## 4. Analysis Plan

### 4.1 Statistical Tests

**H1 (monotonic set size):**
- Spearman rank correlation: Warp factor vs skill index (at 4p)
- Expected: ρ < -0.8, p < 0.01

**H2 (monotonic fleet size):**
- Spearman rank correlation: fleet size vs skill index (at W12)
- Expected: ρ < -0.9, p < 0.01

**H3 (interaction):**
- 2-way ANOVA: Warp factor × fleet size → skill index
- Expected: significant interaction term F > 10, p < 0.001

**H4 (validation):**
- Pearson correlation: skill index vs Commander Δ win rate
- Expected: r > 0.7, p < 0.01

**H5 (W9 vs W12):**
- Paired t-test on individual metrics at 4p
- Bonferroni correction: α = 0.05/10 = 0.005

### 4.2 Visualizations (for paper)

**Figure 1:** Heatmap — Skill index (0-4) by Warp factor (rows) × fleet size (cols)
- Color scale: red (0) → yellow (2) → green (4)
- Diagonal degradation pattern expected

**Figure 2:** Line plot — Each metric (10 lines) vs Warp factor at 4p
- Shows which specific metrics degrade first

**Figure 3:** Scatter plot — Skill index vs Commander win Δ (validation)
- Each point = one config; trendline with 95% CI

**Figure 4:** Small multiples — W6/W9/W12/W15/W18 skill index vs fleet size
- Shows fleet degradation rate differs by Warp factor

**Figure 5:** Box plots — Distribution of hand entropy across Warp factors
- Demonstrates variance increase with set size

### 4.3 Tables (LaTeX for paper)

**Table 1:** Full results matrix (supplement)
- All 42+ configs, all 10 metrics, skill index

**Table 2:** Key comparisons (main text)
- W6/W9/W12/W15/W18 @ 4p only, condensed metrics

**Table 3:** Skill sensitivity validation (main text)
- 7 key configs, Commander vs Ensign Δ, correlation with skill index

---

## 5. Execution Plan

### Phase 1: Infrastructure (1-2 days)
- [ ] Extend deal rules for all Warp factors
- [ ] Update `playSelfPlayGame` to accept `maxPip` parameter
- [ ] Test W3/W6/W15/W18 self-play completes without crashes
- [ ] Verify metrics collection works at W18 @ 18p

### Phase 2: Pilot Study (1 day)
- [ ] Run 100 games each at W6/W9/W12/W15/W18 @ 4p
- [ ] Verify metrics show expected trends (W18 worse than W12)
- [ ] Validate JSON output format
- [ ] Estimate compute time for full study

### Phase 3: Full Collection (1 day, parallelized)
- [ ] Run comprehensive collection script (22,000 games)
- [ ] Monitor for crashes/hangs
- [ ] Save intermediate results every 1000 games

### Phase 4: Skill Sensitivity (1 day)
- [ ] Run 10 key configs @ 1000 games Commander vs Ensign
- [ ] Extract win rate deltas
- [ ] Correlate with skill index

### Phase 5: Analysis (2-3 days)
- [ ] Statistical tests (H1-H5)
- [ ] Generate all figures
- [ ] Build LaTeX tables
- [ ] Write results narrative

### Phase 6: Integration (1 day)
- [ ] Draft Section 8 for paper
- [ ] Add figures to manuscript
- [ ] Update abstract/contributions
- [ ] Proofread

**Total timeline:** 7-10 days from start to paper-ready

---

## 6. Publication Standards

### 6.1 Statistical Rigor
- Report effect sizes (Cohen's d, η²) not just p-values
- Bonferroni correction for multiple comparisons
- 95% confidence intervals on all point estimates
- Power analysis confirms N=500/1000 sufficient

### 6.2 Reproducibility
- Open data: publish `luck-skill-comprehensive.json`
- Open code: `collect-luck-skill-comprehensive.ts` in repo
- Seed documented: 9001 for all runs
- Engine version tagged: `warp12-engine@0.4.25`

### 6.3 Validation
- Skill sensitivity confirms metric validity (H4)
- Cross-objective (go-out) as robustness check
- Ablation: repeat W12 @ 4p with Omega vs Commander (should match)

### 6.4 Limitations Section
- Commander heuristics not superhuman
- No human player data (engine-only)
- Points objective primary (go-out is supplementary)
- Focuses on IWGF Official Warp rules (no house-rule sweep)

---

## 7. Expected Outcomes

### 7.1 Novel Contributions
1. **First comprehensive luck/skill study across domino set sizes**
2. **Quantitative validation of IWGF rating policy** (W12 only)
3. **Interaction effect between set size and fleet size** (not just linear)
4. **Skill ceiling validation via AI win rate sensitivity**
5. **Predictive model for untested configs** (e.g., W21, W24)

### 7.2 Practical Impact
- Guides future domino game design (set size sweet spot)
- Informs rating system decisions for other games
- Provides benchmark for evaluating AI training ROI
- Supports casual vs competitive mode separation

### 7.3 Academic Impact
- Fills gap in imperfect-information game AI literature
- Demonstrates metrics-based skill quantification beyond win rates
- Shows game complexity is multidimensional (not just state space size)

---

## 8. Quick Start Commands

### Run pilot study:
```bash
cd /Volumes/Code/Warp12
yarn build:engine

# Extend deal rules first (manual edit)
# Then:
node --loader tsx tools/nn/collect-luck-skill-pilot.ts
```

### Run full study:
```bash
COMPREHENSIVE_GAMES=500 \
COMPREHENSIVE_WORKERS=15 \
node --loader tsx tools/nn/collect-luck-skill-comprehensive.ts \
  2>&1 | tee tools/nn/data/comprehensive-collection.log
```

### Analyze results:
```bash
node --loader tsx tools/nn/analyze-luck-skill.ts
# Outputs: figures/, tables/, stats-summary.md
```

---

## 9. Timeline to Submission

Assuming 2-week sprint:

**Week 1:**
- Day 1-2: Infrastructure + pilot
- Day 3-4: Full collection
- Day 5: Skill sensitivity validation

**Week 2:**
- Day 6-7: Statistical analysis
- Day 8-9: Figures + tables
- Day 10: Write Section 8
- Day 11-12: Integrate into paper, proofread
- Day 13-14: Internal review, final polish

**Submission-ready:** 14 days from start

---

## 10. Budget Estimate

**Compute:**
- Free (runs on your M4 Max)

**Researcher time:**
- 2 weeks full-time or 4 weeks part-time

**Expected output:**
- 1 journal-quality section (~10 pages)
- 5 publication-quality figures
- 3 data tables
- 1 open dataset (~100MB)
- Code artifact for reproducibility

**ROI:** High — this would be a **landmark empirical study** in domino game AI, potentially citation-worthy on its own.
