# Module Analysis Status

## Overview
Framework is ready to run comprehensive luck vs skill analysis across all module configurations.

## What's Ready ✓

### 1. Collection Script
- **File**: `tools/nn/collect-luck-skill-modules.ts`
- **Status**: ✓ Complete (duplicate line fixed)
- **Function**: Tests single config (warp × players × module)

### 2. Parallel Orchestration
- **File**: `tools/nn/run-module-analysis-parallel.sh`
- **Status**: ✓ Complete
- **Function**: Manages worker pool, runs all 342 configs

### 3. Analysis & Reporting
- **File**: `tools/nn/analyze-module-results.ts`
- **Status**: ✓ Complete
- **Function**: Aggregates results, generates markdown + JSON reports

### 4. Documentation
- **File**: `tools/nn/README-MODULE-ANALYSIS.md`
- **Status**: ✓ Complete
- **Function**: Usage guide and methodology

## Configuration Matrix

### Warp Factors × Players (38 combinations)
- **W9**: 2-4 players (3 configs)
- **W12**: 2-8 players (7 configs) — *rated factor*
- **W15**: 2-12 players (11 configs)
- **W18**: 2-18 players (17 configs)

### Module Configurations (9 configs)

#### Individual Modules (Alpha-Zeta)
1. **none** — Baseline (no modules)
2. **alpha** — Module Alpha (Continuum / Q-Continuum)
   - 0-0 triggers reality-bending effects
3. **beta** — Module Beta (Salamander Penalty)
   - Holding the highest double (maxPip-maxPip) at round end scores double its pips (Warp 12 → 48; Warp 18 → 72)
4. **gamma** — Module Gamma (Sensor Grid / Long-Range Sensor Sweep)
   - Visible market of tiles for strategic draws
5. **delta** — Module Delta (Warp Drive Spool / Hot Potato)
   - Draw continuously until mismatch
6. **epsilon** — Module Epsilon (Drafting / Tactical Requisition)
   - Draft-based deal instead of random
7. **zeta** — Module Zeta (Squadrons / Fleet Squadrons)
   - Team play with shared trails

#### Combined Configurations
8. **official** — Official Warp 12 Preset
   - Alpha (Continuum) + Beta (Salamander Penalty)
   - Plus house rules: Drop to Impulse, All Stop ceremony, doubleZero=0
9. **all** — All Modules Enabled (stress test)
   - All modules EXCEPT drafting (incompatible with others)
   - Includes additional modules: Longest Trail, Double Down, Temporal Debt, Temporal Inversion, Wormholes, Subspace Fracture

### Total Scale
- **342 configurations** (38 warp/player × 9 modules)
- At 500 games each = **171,000 games**
- At 100 games each = **34,200 games** (quick test)

## Performance Estimates (M4 Max, 12 workers)

| Games/Config | Total Games | Est. Time |
|--------------|-------------|-----------|
| 100 | 34,200 | 20-40min |
| 500 | 171,000 | 2-4 hours |
| 1000 | 342,000 | 4-8 hours |

Game speed varies:
- Simple configs (none): ~0.3s/game
- Complex configs (all): ~2s/game

## Skill Indicators (0-4 scale)

Each config measures 4 dimensions:
1. **Legal Moves** ≥ 3.0 → Meaningful choice
2. **Constrained Tiles** > 50% → Strategic placement matters
3. **Move Value Spread** ≥ 2.0 → Quality differences detectable
4. **Pip Variance** ≥ 10.0 → Skill can control variance

**Interpretation:**
- **3-4 indicators**: ✓ Skill-dominant (promote for competitive)
- **2 indicators**: ~ Mixed (acceptable for rated)
- **0-1 indicators**: ✗ Luck-dominant (avoid for competitive)

## How to Run

### Quick Test (20-40 min)
```bash
MODULE_GAMES=100 MODULE_WORKERS=12 bash tools/nn/run-module-analysis-parallel.sh
```

### Full Analysis (2-4 hours)
```bash
MODULE_GAMES=500 MODULE_WORKERS=12 bash tools/nn/run-module-analysis-parallel.sh
```

### Extended Analysis (4-8 hours)
```bash
MODULE_GAMES=1000 MODULE_WORKERS=12 bash tools/nn/run-module-analysis-parallel.sh
```

### Generate Report
```bash
npx tsx tools/nn/analyze-module-results.ts
```

## Output Files

### Individual Results
`tools/nn/data/luck-skill-w{factor}-p{players}-m{module}.json`

Examples:
- `luck-skill-w12-p4-mnone.json`
- `luck-skill-w12-p4-malpha.json`
- `luck-skill-w12-p4-mofficial.json`

### Aggregated Reports
- `tools/nn/data/module-analysis-summary.json` — Machine-readable
- `docs/MODULE-ANALYSIS.md` — Human-readable with recommendations

## What Happens Next

After running the analysis:

1. **Review recommendations** in `docs/MODULE-ANALYSIS.md`
2. **Update RULES.md Section VI** with module balance findings
3. **Update TEI paper** with empirical module data
4. **Adjust UI defaults** based on skill-dominant configs
5. **Update leaderboard** charter setup based on recommendations

## Paper Integration

The TEI paper (`docs/tei-paper.tex`) references module analysis in:
- **Section 3**: Module descriptions (high-level)
- **Section 8**: Luck vs skill across configurations
- **Discussion**: Module balance and competitive recommendations

Current paper status: References module analysis but **data doesn't exist yet**.

## Module Descriptions (from actual code)

The analysis tests these actual module implementations:

### Core Modules (Tested Individually)
- **Continuum (Alpha)**: Q-Continuum flash effects on 0-0
- **Salamander Penalty (Beta)**: highest double (maxPip-maxPip) scores double its pips at round end (round 2+); Warp 12 → 48, Warp 18 → 72
- **Sensor Grid (Gamma)**: 5-tile visible market
- **Warp Drive Spool (Delta)**: Continuous draw until mismatch
- **Drafting (Epsilon)**: Pack-and-pass deal (15 tiles/pack default)
- **Squadrons (Zeta)**: 2-captain teams with shared trails

### Extended Modules (Only in "all" config)
- **Longest Trail**: Bonus for captain with longest trail (-3 pips)
- **Double Down**: Playing double forces next player to draw 2
- **Temporal Debt**: Drawing from pile accumulates debt (2 pips/token)
- **Temporal Inversion**: Alternating rounds have inverted scoring
- **Wormholes**: Double on NZ swaps captain's trail
- **Subspace Fracture**: Chicken-foot on doubles (scope: all-doubles)

## Decision Point

**Question:** Ready to run the full analysis?

**Options:**
1. **Quick test** (100 games, ~30 min) — Validate methodology
2. **Full analysis** (500 games, ~3 hours) — Publication-grade data
3. **Extended** (1000 games, ~6 hours) — Maximum confidence
4. **Wait** — Defer until needed

**Recommendation:** Start with **quick test** to validate:
- Scripts work correctly
- Results make sense
- Module configs match expectations

Then run **full analysis** for paper integration.

## Known Issues
- ✓ Fixed: Duplicate `warpDriveSpool` line in delta config
- None remaining

## Next User Action Required

1. Choose analysis scale (quick/full/extended)
2. Run: `MODULE_GAMES=<100|500|1000> MODULE_WORKERS=12 bash tools/nn/run-module-analysis-parallel.sh`
3. Generate report: `npx tsx tools/nn/analyze-module-results.ts`
4. Review and integrate findings

---

**Status**: Ready to execute ✓
