# Module Analysis - Skill vs Luck

Comprehensive testing framework to quantify the skill ceiling of every Warp configuration.

## Quick Start (M4 Max)

Run the full analysis with recommended settings:

```bash
# Full analysis: ~2-4 hours on M4 Max
MODULE_GAMES=500 MODULE_WORKERS=12 bash tools/nn/run-module-analysis-parallel.sh

# Quick test (100 games): ~20-40 minutes
MODULE_GAMES=100 MODULE_WORKERS=12 bash tools/nn/run-module-analysis-parallel.sh

# Generate report
npx tsx tools/nn/analyze-module-results.ts
```

## What Gets Tested

### Warp Factors
- **W9**: 2-4 players (3 configurations)
- **W12**: 2-8 players (7 configurations) - *rated factor*
- **W15**: 2-12 players (11 configurations)
- **W18**: 2-18 players (17 configurations)

**Total**: 38 warp/player combinations

### Module Configurations
- **none**: Baseline (no modules)
- **alpha**: Module Alpha (Continuum)
- **beta**: Module Beta (Salamander Penalty)
- **gamma**: Module Gamma (Sensor Grid)
- **delta**: Module Delta (Warp Drive Spool)
- **epsilon**: Module Epsilon (Drafting)
- **zeta**: Module Zeta (Squadrons)
- **official**: Official Warp 12 preset (Alpha + Beta + house rules)
- **all**: All modules enabled (stress test)

**Total**: 9 module configurations

### Total Configurations
**38 warp/player × 9 modules = 342 configurations**

At 500 games each = **171,000 games**

## Metrics Collected

Each configuration measures:

1. **Legal Moves**: Average choices per turn (skill floor)
2. **Constrained Tiles**: % of tiles with limited placement options
3. **Move Value Spread**: Difference between best/worst move
4. **Pip Variance**: Standard deviation of pip totals

These combine into **skill indicators (0-4)**:
- **4**: Highly skill-dependent
- **3**: Skill-dominant ✓
- **2**: Mixed
- **1**: Luck-leaning
- **0**: Highly luck-dependent ✗

## Output Files

### Individual Results
`tools/nn/data/luck-skill-w{factor}-p{players}-m{module}.json`

Example: `luck-skill-w12-p4-malpha.json`

### Aggregated Reports
- `tools/nn/data/module-analysis-summary.json` - Machine-readable summary
- `docs/MODULE-ANALYSIS.md` - Human-readable report with recommendations

## Performance

**M4 Max (14 cores)** with `MODULE_WORKERS=12`:

| Games/Config | Total Games | Est. Time |
|--------------|-------------|-----------|
| 100 | 34,200 | 20-40min |
| 500 | 171,000 | 2-4 hours |
| 1000 | 342,000 | 4-8 hours |

Game speed varies by configuration:
- Simple (none): ~0.3s/game
- Complex (all): ~2s/game

## Advanced Usage

### Test Specific Combinations

```bash
# Test only W12 with 4 players, Official preset
MODULE_WARP_FACTOR=12 \
MODULE_PLAYER_COUNT=4 \
MODULE_CONFIG=official \
MODULE_GAMES=1000 \
npx tsx tools/nn/collect-luck-skill-modules.ts
```

### Custom Worker Count

```bash
# Conservative (8 workers)
MODULE_WORKERS=8 bash tools/nn/run-module-analysis-parallel.sh

# Aggressive (14 workers - use all cores)
MODULE_WORKERS=14 bash tools/nn/run-module-analysis-parallel.sh
```

### Different Objectives

```bash
# Go-out mode instead of points
MODULE_OBJECTIVE=go-out bash tools/nn/run-module-analysis-parallel.sh
```

## Interpreting Results

### Skill Indicators

**3-4 indicators** = ✓ Promote for competitive play
- Multiple strategic dimensions
- Meaningful skill differentiation
- Suitable for ratings/tournaments

**2 indicators** = ~ Neutral
- Mixed skill/luck balance
- Acceptable for casual rated play
- May have situational skill expression

**0-1 indicators** = ✗ Avoid for competitive
- Luck-dominated outcomes
- Limited strategic depth
- Better for casual/social play

### Example Interpretation

```
Module: alpha (Continuum)
Avg skill indicators: 3.2/4
Skill-dominant: 32/38 configs (84%)
Recommendation: ✓ Promote
```

This means Continuum maintains high skill across most configurations and should be encouraged for competitive play.

## Troubleshooting

### "Out of memory"
Reduce worker count: `MODULE_WORKERS=8`

### "Command not found: npx"
Install Node.js 20+ and yarn

### Stuck/hanging
Check running workers: `ps aux | grep tsx`
Kill if needed: `pkill -f collect-luck-skill-modules`

### Results seem wrong
Verify games completed: `ls -l tools/nn/data/luck-skill-*.json`
Check individual logs in output

## Citation

When publishing results, cite as:

```
Warp Module Analysis [version]
Interstellar Warp Dominoes Federation
Analysis date: [timestamp]
Method: Self-play (Commander AI, 500 games/config)
```

---

**Next Steps**: After analysis completes, update `RULES.md` Section VI with module recommendations based on the skill indicators.
