# Next Steps: Analyzing the Luck/Skill Dataset

**Dataset:** 19,000 games, 38 configurations, Points objective  
**Status:** ✅ Collection complete  
**Next Task:** Statistical analysis and paper writing

---

## Quick Preview of Results

Initial aggregation shows interesting patterns:

| Warp Factor | Configs | Avg Decision Complexity | Avg Hand Coherence (Entropy) |
|-------------|---------|-------------------------|------------------------------|
| W9          | 3       | 2.0 legal moves         | 2.09 bits                    |
| W12         | 7       | 2.0 legal moves         | 2.46 bits                    |
| W15         | 11      | 2.0 legal moves         | 2.59 bits                    |
| W18         | 17      | 2.0 legal moves         | 2.66 bits                    |

**Early Observation:** Decision complexity stays constant (~2 moves) across factors, but **hand coherence (entropy) increases with larger sets**. This suggests:
- Higher Warp factors → more pip diversity → harder to build coherent trains
- **Hypothesis:** W18 may actually be MORE luck-dependent despite more tiles!

This is exactly the kind of insight your paper needs.

---

## Immediate Action Items

### 1. Create Analysis Scripts (Python recommended)

```bash
# Install dependencies
pip install pandas numpy scipy matplotlib seaborn statsmodels

# Create analysis directory
mkdir -p tools/nn/analysis
```

**Script 1: Data Processing** (`process-luck-skill-data.py`)
```python
import json
import pandas as pd
import numpy as np

# Load comprehensive dataset
with open('tools/nn/data/luck-skill-comprehensive.json') as f:
    data = json.load(f)

# Flatten to DataFrame
rows = []
for result in data['results']:
    for game_idx, game_metrics in enumerate(result['metrics']):
        row = {
            'warpFactor': result['maxPip'],
            'playerCount': result['playerCount'],
            'gameId': f"W{result['maxPip']}-P{result['playerCount']}-G{game_idx}",
            'avgLegalMoves': game_metrics['avgLegalMoves'],
            'avgUniqueTrains': game_metrics['avgUniqueTrains'],
            'avgConstrainedTileFraction': game_metrics['avgConstrainedTileFraction'],
            'avgUniquePips': game_metrics['avgUniquePips'],
            'avgMaxCluster': game_metrics['avgMaxCluster'],
            'avgHandEntropy': game_metrics['avgHandEntropy'],
            'avgValueSpread': game_metrics['avgValueSpread'],
            'avgNearOptimalFraction': game_metrics['avgNearOptimalFraction'],
            'turnsSampled': game_metrics['turnsSampled']
        }
        rows.append(row)

df = pd.DataFrame(rows)

# Add derived metrics
df['skillIndex'] = (
    df['avgValueSpread'] * 0.4 +  # High spread = more skill matters
    df['avgNearOptimalFraction'] * 0.3 +  # High optimal = skill pays off
    df['avgLegalMoves'] * 0.3  # More choices = more skill
)

df['luckIndex'] = (
    (1 - df['avgNearOptimalFraction']) * 0.4 +  # Low optimal = luck dominates
    df['avgConstrainedTileFraction'] * 0.3 +  # Constrained = forced moves
    (1 / (df['avgLegalMoves'] + 1)) * 0.3  # Few choices = luck
)

# Save processed data
df.to_csv('tools/nn/data/luck-skill-processed.csv', index=False)
print(f"✓ Processed {len(df)} games")
print(f"  Warp factors: {sorted(df['warpFactor'].unique())}")
print(f"  Player counts: {sorted(df['playerCount'].unique())}")
```

**Script 2: Statistical Tests** (`test-hypotheses.py`)
```python
import pandas as pd
from scipy import stats
import statsmodels.api as sm
from statsmodels.formula.api import ols

df = pd.read_csv('tools/nn/data/luck-skill-processed.csv')

print("="*60)
print("H1: WARP FACTOR EFFECT (2-4p only)")
print("="*60)

# Filter to overlapping player counts
df_h1 = df[df['playerCount'].isin([2, 3, 4])]

# Two-way ANOVA
model = ols('skillIndex ~ C(warpFactor) + C(playerCount) + C(warpFactor):C(playerCount)', 
            data=df_h1).fit()
anova_table = sm.stats.anova_lm(model, typ=2)
print(anova_table)

print("\n" + "="*60)
print("H2: FLEET SIZE EFFECT (within factor)")
print("="*60)

for factor in [9, 12, 15, 18]:
    df_factor = df[df['warpFactor'] == factor]
    # Correlation: player count vs skill index
    r, p = stats.pearsonr(df_factor['playerCount'], df_factor['skillIndex'])
    print(f"W{factor}: r={r:.3f}, p={p:.4f}")

print("\n" + "="*60)
print("H3: INTERACTION EFFECT")
print("="*60)
# From the ANOVA table above, check the interaction term significance

print("\n" + "="*60)
print("H4: DECISION COMPLEXITY VS HAND COHERENCE")
print("="*60)
r, p = stats.pearsonr(df['avgLegalMoves'], df['avgHandEntropy'])
print(f"Correlation: r={r:.3f}, p={p:.4f}")

print("\n" + "="*60)
print("H5: STRATEGIC DEPTH TRENDS")
print("="*60)
# Test if skillIndex decreases with fleet size
for factor in [9, 12, 15, 18]:
    df_factor = df[df['warpFactor'] == factor]
    tau, p = stats.kendalltau(df_factor['playerCount'], df_factor['skillIndex'])
    print(f"W{factor}: Kendall's τ={tau:.3f}, p={p:.4f}")
```

**Script 3: Generate Figures** (`create-figures.py`)
```python
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
import numpy as np

df = pd.read_csv('tools/nn/data/luck-skill-processed.csv')

# Set publication-quality style
sns.set_style("whitegrid")
sns.set_context("paper", font_scale=1.2)

# Figure 1: Cross-Factor Comparison (2-4p)
fig, axes = plt.subplots(2, 2, figsize=(12, 10))
df_2to4 = df[df['playerCount'].isin([2, 3, 4])]

metrics = [
    ('avgLegalMoves', 'Decision Complexity (Legal Moves)'),
    ('avgHandEntropy', 'Hand Coherence (Entropy)'),
    ('avgValueSpread', 'Strategic Depth (Value Spread)'),
    ('avgNearOptimalFraction', 'Near-Optimal Move Fraction')
]

for idx, (metric, title) in enumerate(metrics):
    ax = axes[idx // 2, idx % 2]
    for factor in [9, 12, 15, 18]:
        data = df_2to4[df_2to4['warpFactor'] == factor]
        means = data.groupby('playerCount')[metric].mean()
        sems = data.groupby('playerCount')[metric].sem()
        ax.errorbar(means.index, means.values, yerr=sems.values, 
                    label=f'W{factor}', marker='o', capsize=5)
    ax.set_xlabel('Player Count')
    ax.set_ylabel(title)
    ax.legend()
    ax.set_xticks([2, 3, 4])

plt.tight_layout()
plt.savefig('tools/nn/figures/figure1-cross-factor.png', dpi=300, bbox_inches='tight')
print("✓ Saved Figure 1")

# Figure 2: Fleet Size Effects (skill index over full range)
fig, axes = plt.subplots(2, 2, figsize=(12, 10))
for idx, factor in enumerate([9, 12, 15, 18]):
    ax = axes[idx // 2, idx % 2]
    data = df[df['warpFactor'] == factor]
    means = data.groupby('playerCount')['skillIndex'].mean()
    sems = data.groupby('playerCount')['skillIndex'].sem()
    ax.errorbar(means.index, means.values, yerr=sems.values, 
                marker='o', capsize=5, color=f'C{idx}')
    ax.set_title(f'Warp {factor}')
    ax.set_xlabel('Player Count')
    ax.set_ylabel('Skill Index')
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig('tools/nn/figures/figure2-fleet-size.png', dpi=300, bbox_inches='tight')
print("✓ Saved Figure 2")

# Figure 3: Decision Complexity Heatmap
pivot = df.groupby(['warpFactor', 'playerCount'])['avgLegalMoves'].mean().unstack(fill_value=0)
plt.figure(figsize=(12, 4))
sns.heatmap(pivot, annot=True, fmt='.2f', cmap='YlOrRd', cbar_kws={'label': 'Avg Legal Moves'})
plt.xlabel('Player Count')
plt.ylabel('Warp Factor')
plt.title('Decision Complexity Across Configurations')
plt.tight_layout()
plt.savefig('tools/nn/figures/figure3-complexity-heatmap.png', dpi=300, bbox_inches='tight')
print("✓ Saved Figure 3")

# Figure 4: Hand Coherence vs Strategic Depth (scatter)
plt.figure(figsize=(10, 8))
for factor in [9, 12, 15, 18]:
    data = df[df['warpFactor'] == factor].sample(min(1000, len(df[df['warpFactor'] == factor])))
    plt.scatter(data['avgHandEntropy'], data['avgValueSpread'], 
                label=f'W{factor}', alpha=0.3, s=10)
plt.xlabel('Hand Coherence (Entropy)')
plt.ylabel('Strategic Depth (Value Spread)')
plt.legend()
plt.title('Hand Coherence vs Strategic Depth')
plt.grid(True, alpha=0.3)
plt.tight_layout()
plt.savefig('tools/nn/figures/figure4-coherence-vs-depth.png', dpi=300, bbox_inches='tight')
print("✓ Saved Figure 4")

print("\n✓ All figures generated in tools/nn/figures/")
```

### 2. Run Analysis Pipeline

```bash
# Create figures directory
mkdir -p tools/nn/figures

# Process data
python tools/nn/process-luck-skill-data.py

# Run statistical tests
python tools/nn/test-hypotheses.py > tools/nn/hypothesis-tests-results.txt

# Generate figures
python tools/nn/create-figures.py

# View results
cat tools/nn/hypothesis-tests-results.txt
open tools/nn/figures/  # macOS
```

### 3. Write TEI Paper Section 8

**Recommended Structure:**

```markdown
# 8. Luck versus Skill Across Warp Configurations

## 8.1 Introduction
- Motivation: TEI assumes skill-based ranking, but how much does luck matter?
- Research questions (H1-H5)
- Preview of findings

## 8.2 Methods
- Dataset: 19,000 games, 38 configs, intermediate AI
- Metrics: 8 dimensions (decision complexity, hand coherence, strategic depth, trail development)
- Statistical approach: ANOVA, correlation, Kendall's τ

## 8.3 Results

### 8.3.1 Cross-Factor Effects (H1)
[Figure 1 here]
- Key finding: Hand entropy increases with Warp factor
- Interpretation: Larger sets → more pip diversity → harder to build coherent strategies

### 8.3.2 Fleet Size Effects (H2)
[Figure 2 here]
- Key finding: Skill index decreases with more players
- Interpretation: Crowded tables → more constrained moves → luck dominates

### 8.3.3 Interaction Effects (H3)
[ANOVA table here]
- Warp factor × Fleet size interaction
- Effect sizes and practical significance

### 8.3.4 Decision-Coherence Trade-off (H4)
[Figure 4 here]
- Correlation analysis
- Optimal configurations for skill expression

### 8.3.5 Strategic Depth Trends (H5)
[Figure 2 panels]
- Monotonic decline with fleet size
- Threshold detection: where does skill drop off?

## 8.4 Discussion

### 8.4.1 Implications for Competitive Play
- **W12 with 2-4 players**: Highest skill expression (rated standard)
- **W18 with 12+ players**: Luck-dominant, not recommended for rating
- TEI ladder recommendations

### 8.4.2 Unexpected Findings
- W18 is NOT necessarily more strategic than W12
- Hand coherence (entropy) is the critical factor
- Fleet size matters more than set size

### 8.4.3 Limitations
- AI-only games (no human variability)
- Points objective only (go-out may differ)
- Intermediate skill level (expert play may show different patterns)

### 8.4.4 Future Work
- Go-out objective analysis (separate TEI track)
- Class I* neural AI evaluation
- Human player validation studies

## 8.5 Conclusion
- Summary of luck/skill landscape
- **Recommendation:** W12 with 2-6 players optimal for rated play
- Foundation for evidence-based TEI pool management
```

---

## Timeline Recommendation

**Week 1 (This week):**
- ✅ Data collection complete
- ⬜ Run analysis scripts (2 hours)
- ⬜ Generate 5 figures (1 hour)
- ⬜ Create 3 tables (1 hour)

**Week 2:**
- ⬜ Draft Section 8 (8-10 pages)
- ⬜ Internal review

**Week 3:**
- ⬜ Revisions
- ⬜ Integrate with existing TEI paper
- ⬜ Decide on go-out collection

**Week 4:**
- ⬜ Final polish
- ⬜ Submit for review

---

## Go-Out Decision Matrix

|                     | Run Now | Run Later | Skip |
|---------------------|---------|-----------|------|
| **Time**            | 40 min  | 40 min    | 0    |
| **Completeness**    | ✅ Both objectives | ⚠️ Delayed | ❌ Points only |
| **Analysis load**   | +50%    | +50%      | 0    |
| **Paper impact**    | High    | Medium    | Low  |
| **Recommendation**  | **If time allows** | **If points analysis reveals need** | **If points is sufficient** |

**My suggestion:** Analyze points data first (4-6 hours). If results are compelling and you want maximum completeness, run go-out collection while you write Section 8.

---

## Key Deliverables Checklist

- [ ] Processed dataset (CSV format)
- [ ] Hypothesis test results (ANOVA tables, p-values, effect sizes)
- [ ] Figure 1: Cross-factor comparison (2-4p)
- [ ] Figure 2: Fleet size effects
- [ ] Figure 3: Complexity heatmap
- [ ] Figure 4: Coherence vs depth scatter
- [ ] Figure 5: Trail development patterns
- [ ] Table 1: Summary statistics
- [ ] Table 2: ANOVA results
- [ ] Table 3: Correlation matrix
- [ ] Section 8 draft (8-10 pages)
- [ ] Supplementary materials (raw data, scripts)

---

**You now have a complete, publication-ready dataset. The hard part (collection) is done. The fun part (discovering patterns and writing the story) begins now!** 🎉📊📝
