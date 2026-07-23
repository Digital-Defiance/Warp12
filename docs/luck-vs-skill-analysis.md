# Quantifying Luck vs Skill in Warp Variants

## The Warp 18 Problem

**Observation**: In 18-player Warp 18 (double-eighteen set, 190 tiles), the game devolves into pure chaos:
- Hand diversity is extreme (many unique pip values per hand)
- Building a coherent personal trail is nearly impossible
- Strategy reduces to "dump heaviest tile on any available train"
- Whoever happens to have one tile when their turn comes wins

**Question**: Can we quantify whether this is truly "all luck" and whether AI can even improve at such a chaotic game?

---

## Proposed Metrics

### 1. **Decision Complexity / Branching Factor**
Track the average number of legal moves per turn:

```typescript
interface TurnDecisionMetrics {
  legalMoveCount: number;
  uniqueTrainOptions: number;  // How many different trains can be played on
  dominoesPlayableOnAnyTrain: number;  // "Universal" tiles
  dominoesPlayableOnSingleTrain: number;  // "Constrained" tiles
}
```

**Hypothesis**: Low branching factor with many constrained tiles = high skill ceiling. High branching factor with many universal tiles = luck-dominated.

- **Warp 12, 4 players**: Avg ~3-5 legal moves, often constrained by pip value → skill matters
- **Warp 18, 18 players**: Avg ~10-20 legal moves, many tiles playable anywhere → chaos

### 2. **Hand Coherence / Pip Clustering**
Measure how "connected" a hand is:

```typescript
interface HandCoherenceMetrics {
  uniquePipValues: number;  // 0-12 for W12, 0-18 for W18
  maxPipCluster: number;  // Largest group of tiles sharing a pip
  longestChain: number;  // Longest potential sequence if you could build a trail
  handEntropy: number;  // Shannon entropy of pip distribution
}
```

**Hypothesis**: Low coherence = can't execute strategy, pure reactive play.

- **Warp 12**: Smaller hands (10-15 tiles), moderate coherence possible
- **Warp 18**: Initial hand could be 6 tiles from 190-tile set → often completely fragmented

### 3. **Strategic Depth: Move Value Spread**
For each turn, evaluate all legal moves and measure the value spread:

```typescript
interface MoveValueMetrics {
  bestMoveValue: number;
  worstMoveValue: number;
  valueSpread: number;  // best - worst
  valueStdDev: number;
  // What % of moves are within 10% of optimal?
  nearOptimalMovePercentage: number;
}
```

**Hypothesis**: Narrow spread = moves are similar quality = luck. Wide spread = clear good/bad moves = skill.

If 80% of legal moves score within 5% of each other, strategic choice barely matters.

### 4. **Outcome Variance Across Identical-Skill Matchups**
Run self-play with identically-configured AIs:

```typescript
interface SkillVarianceMetrics {
  // Win rate variance when all seats are identical
  identicalPlayerWinRateStdDev: number;
  // Expected for pure luck: ~1/N for N players
  // Expected for skill: one seat dominates
  
  // How much does win rate change when you increase skill?
  skillSensitivity: number;  // Δ(win rate) / Δ(skill level)
}
```

**Hypothesis**: 
- High variance + win rates approaching 1/N = luck-dominated
- Low variance + clear skill gradation = skill-dominated

### 5. **Regret / Counterfactual Analysis**
After game completion (when all hands are known), replay each decision:

```typescript
interface RegretMetrics {
  // What % of moves were objectively suboptimal given perfect information?
  suboptimalMoveRate: number;
  
  // Average points/turns lost due to suboptimal plays
  averageRegret: number;
  
  // Could the game outcome have changed with perfect play?
  outcomeRegret: boolean;
}
```

**Hypothesis**: If perfect-information replay shows minimal outcome changes, luck dominates. If perfect play dramatically changes outcomes, skill dominates.

### 6. **Train Development Success Rate**
Track how often players successfully "develop" their trail:

```typescript
interface TrailDevelopmentMetrics {
  turnsWithOwnTrailPlay: number;
  turnsForced ToOtherTrains: number;
  consecutiveOwnTrailPlays: number[];  // Array of run lengths
  shieldsDownPercentage: number;
}
```

**Hypothesis**: If players rarely play on their own trail (forced to opportunistically dump elsewhere), strategic planning is impossible.

---

## Proposed Implementation

### Phase 1: Instrumentation
Add metrics collection to `self-play.ts`:

```typescript
export interface SelfPlayGameMetrics {
  // Per-game aggregates
  averageLegalMoves: number;
  averageHandCoherence: number;
  averageMoveValueSpread: number;
  
  // Per-turn breakdown (optional, for deep analysis)
  turnMetrics?: TurnMetrics[];
}

export interface SelfPlayGameResult {
  winnerId: PlayerId | null;
  completed: boolean;
  completedRounds: number;
  steps: number;
  points: Record<PlayerId, number>;
  finalState: GameState;
  
  // NEW
  metrics?: SelfPlayGameMetrics;
}
```

### Phase 2: Comparative Benchmarks
Run standardized tests across Warp factors:

```typescript
// Compare 4-player matches across all Warp factors
const benchmarks = {
  warp9_4p: await runLuckSkillBench({ maxPip: 9, playerCount: 4, games: 1000 }),
  warp12_4p: await runLuckSkillBench({ maxPip: 12, playerCount: 4, games: 1000 }),
  warp15_4p: await runLuckSkillBench({ maxPip: 15, playerCount: 4, games: 1000 }),
  warp18_4p: await runLuckSkillBench({ maxPip: 18, playerCount: 4, games: 1000 }),
  
  // Extreme cases
  warp12_2p: await runLuckSkillBench({ maxPip: 12, playerCount: 2, games: 1000 }),
  warp12_8p: await runLuckSkillBench({ maxPip: 12, playerCount: 8, games: 1000 }),
  warp18_18p: await runLuckSkillBench({ maxPip: 18, playerCount: 18, games: 1000 }),
};
```

### Phase 3: Skill Sensitivity Test
Most important: does AI improvement even matter?

```typescript
// Run matches with skill gradients
const skillTest = {
  // All seats equal (Lieutenant)
  baseline: runMatch({ allSeats: 'class-iii' }),
  
  // One stronger seat
  oneStrong: runMatch({ seatA: 'commander', rest: 'class-iii' }),
  
  // Measure win rate delta
  skillSensitivity: oneStrong.seatAWinRate - (1 / playerCount),
};
```

**Expected results**:
- **Warp 12, 4p**: Commander should win ~40-50% (skill matters)
- **Warp 18, 18p**: Commander might win ~6-8% (only slightly above 5.5% = 1/18, luck dominates)

---

## Theoretical Predictions

### Warp 12 (Double-Twelve, 91 tiles)
- 4 players, 15-tile hands: **Moderate skill**
  - Hand coherence possible
  - Strategic trail building viable
  - AI improvement should show ~20-40% win rate delta
  
- 8 players, 10-tile hands: **Lower skill** 
  - Fragmented hands, less planning depth
  - AI delta might drop to ~10-15%

### Warp 18 (Double-Eighteen, 190 tiles)
- 4 players, 15-tile hands: **Moderate-to-low skill**
  - Larger pip range (0-18) = less clustering
  - More train variety, but still manageable
  - AI delta ~10-20%?
  
- 18 players, 6-tile hands: **Minimal skill** (your case)
  - Extreme fragmentation
  - No strategic planning possible
  - AI delta might be ~1-3% (barely above noise)
  - Game becomes "Chutes and Ladders with dominoes"

---

## Answering Your Questions

### "Is that something an AI can improve at at all?"
**Measurable answer**: Run skill-sensitivity tests. If Commander wins 6% (vs expected 5.5%) in 18-player Warp 18, that's only 0.5 percentage points of skill expression — essentially noise.

### "Is that something we can say is 'luck'?"
**Yes, with quantification**:
1. **High branching factor** (many legal moves, most similar quality)
2. **Low hand coherence** (fragmented pip distribution)
3. **Flat move value spread** (dumping heaviest ≈ optimal for 80%+ of turns)
4. **Win rate approaching 1/N** across skill levels
5. **Low regret** (perfect-information replay barely changes outcomes)

All five point to luck-dominated game.

---

## Next Steps

1. **Add metrics collection** to `self-play.ts` (basic version: legal move count, hand coherence)
2. **Run comparative benchmark** across Warp 9/12/15/18 at 4p
3. **Run extreme case** (Warp 18, 18 players) with skill sensitivity test
4. **Publish results** as `docs/luck-skill-analysis.md` with data

Would you like me to start implementing the instrumentation?

---

## Practical Implications

### For TEI / Rating
If Warp 18 proves luck-dominated (skill delta <5%), consider:
- **Only Warp 12 rated** (current policy) ✅ correct
- Warp 15 might be borderline (needs testing)
- Warp 18 should remain exhibition-only

### For AI Training
If Warp 18 at 18p has minimal skill expression:
- Don't waste compute training Class I★ / Omega models on it
- Simple heuristics (greedy heaviest-first) might be 95% optimal
- Training data from chaotic variants adds noise, not signal

### For Player Communication
Document findings in RULES.md:
> **Warp 18 at maximum fleet size (18 captains)**: IWGF analysis indicates this configuration is primarily luck-driven. Strategic planning is severely constrained by hand fragmentation and high train availability. Recommended for chaotic, casual play — not competitive rating.
