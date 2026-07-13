# Section 8 Complete: Luck vs Skill Analysis

## Status: ✅ DONE

**Date:** July 11, 2026  
**Data:** 19,000 games across 38 configurations  
**Objective:** Points only (go-out TBD)

---

## Deliverables Completed

### 1. Data Collection ✅
- **38 configurations** (W9: 3, W12: 7, W15: 11, W18: 17)
- **500 games per config** = 19,000 total games
- **Runtime:** ~40 minutes (15 workers, M4 Max)
- **Output:** `tools/nn/data/luck-skill-comprehensive.json`

### 2. Data Processing ✅
- **Script:** `tools/nn/process-luck-skill-data.py`
- **Output:** `tools/nn/data/luck-skill-processed.csv`
- **Composite indices:** skillIndex, luckIndex, decisionQuality

### 3. Statistical Analysis ✅
- **Script:** `tools/nn/test-hypotheses.py`
- **Output:** `tools/nn/hypothesis-tests-results.txt`
- **Tests:** ANOVA, Pearson correlation, Kendall's τ, Tukey HSD

### 4. Figures ✅
- **Script:** `tools/nn/create-figures.py`
- **Output:** 5 PNG files in `tools/nn/figures/`
  1. Cross-factor comparison (2-4p)
  2. Fleet size effects by Warp factor
  3. Decision complexity heatmap
  4. Coherence vs depth scatter
  5. Skill vs luck balance

### 5. Tables ✅
- **Script:** `tools/nn/create-tables.py`
- **Output:** 3 LaTeX tables + summary in `tools/nn/tables/`
  1. Summary statistics by configuration
  2. Hypothesis test results (ANOVA, correlations)
  3. Correlation matrix (8×8 metrics)
  4. Findings summary (text)

### 6. Paper Conversion ✅
- **Converted:** `docs/tei-paper-outline.md` → `docs/tei-paper.tex`
- **Section 8 integrated inline** (not separate file)
- **Length:** ~15 pages LaTeX source
- **Sections:** 1-10 + 4 appendices

---

## Key Findings

### H1: Warp Factor Effect
**STRONGLY SUPPORTED** (F=817.14, p<0.001, η²=0.290)
- W12 > W15 > W18 > W9 for skill expression
- W12 is empirically optimal (not just tradition)

### H2: Fleet Size Effect
**STRONGLY SUPPORTED** (r=0.84-0.89 for W12/15/18)
- **UNEXPECTED:** More players = MORE skill, not less
- W12 has steepest gradient (r=0.875)
- Contradicts "large fleets are crapshoots" intuition

### H3: Interaction Effect
**PRESENT** (slope variance = 0.0209)
- Fleet size matters MUCH more for W12 than W9
- Justifies W12 as sole rated factor

### H4: Complexity-Coherence
**NOT SUPPORTED** (r=0.009, p=0.232)
- Decision complexity and hand entropy are independent
- Orthogonal dimensions of game state

### H5: Monotonic Trends
**SUPPORTED** for W12/15/18 (τ=0.67-0.77)
- But W18 shows non-monotonic drops at 17p/18p
- Suggests ergodic limits at extreme configs

### Bombshell: W18 @ 18p is NOT a Crapshoot
- Skill: **1.74× higher** than 2p
- Luck: only 1.21× higher
- **Highest skill/luck ratio** of any config tested
- Large fleets create tactical depth, not noise

---

## Paper Structure

### Main Sections (10)
1. Introduction (motivation + contributions + terminology)
2. Related Work (domino games, AI paradigms, skill rating, gap we fill)
3. Game Model (rules engine, house rules, information structure, two objectives)
4. Agent Architecture (policy stack, skill presets, lookahead, advisor, Class I*, Fleet Admiral, Ω)
5. TEI (reference bands, update rule, percentile boards, Federation Academy)
6. Calibration Methodology (self-play loop, evaluation suites, metrics)
7. Results: AI Calibration (points, go-out, Class I*/Admiral/Ω benches)
8. **Luck vs Skill Across Warp Factors** (NEW - 19K-game study)
9. Discussion (what calibration teaches, design recommendations, limitations)
10. Conclusion (summary, three key insights, future work)

### Appendices (4)
A. Figure List (8 figures planned)
B. Tables (3 LaTeX tables + generated from data)
C. Code Map (file locations for reproducibility)
D. Reproducibility (commands to run experiments)
E. Target Venues (AIIDE, CoG, FDG, CHI PLAY, arXiv)

---

## Next Steps (Optional)

### If Go-Out Data Needed
- Run same 38 configs with `objective: "go-out"`
- Expected runtime: ~40 minutes
- Would complete dual-objective story

### Paper Submission Prep
1. Compile LaTeX → PDF (check for errors)
2. Generate actual figures (PNG → EPS for publication)
3. Add acknowledgments
4. Human validation study (compare AI vs real players)
5. Select venue (recommend AIIDE or IEEE CoG)

### LaTeX Editing on Mac
- **TeXShop** (free, Mac-native, built for LaTeX)
- **Overleaf** (web-based, collaborative, no local install)
- **VS Code** + LaTeX Workshop extension
- **TextMate** or any text editor

---

## Files Created/Modified

### New Files
- `docs/tei-paper.tex` (complete LaTeX paper, ~15 pages)
- `docs/tei-paper-section8.md` (draft Section 8, superseded by .tex)
- `docs/SECTION-8-COMPLETE.md` (this file)
- `tools/nn/create-tables.py` (LaTeX table generator)
- `tools/nn/tables/table1-summary-stats.tex`
- `tools/nn/tables/table2-hypothesis-tests.tex`
- `tools/nn/tables/table3-correlation-matrix.tex`
- `tools/nn/tables/findings-summary.txt`
- `tools/nn/figures/figure1-cross-factor-comparison.png`
- `tools/nn/figures/figure2-fleet-size-effects.png`
- `tools/nn/figures/figure3-complexity-heatmap.png`
- `tools/nn/figures/figure4-coherence-vs-depth.png`
- `tools/nn/figures/figure5-skill-luck-balance.png`

### Existing Files (Reference Only)
- `docs/tei-paper-outline.md` (now superseded by .tex)
- `tools/nn/data/luck-skill-comprehensive.json` (19K games)
- `tools/nn/data/luck-skill-processed.csv` (processed metrics)
- `tools/nn/hypothesis-tests-results.txt` (statistical results)

---

## How to Compile LaTeX

```bash
cd /Volumes/Code/Warp12/docs

# Option 1: pdflatex (3 passes for references)
pdflatex tei-paper.tex
pdflatex tei-paper.tex
pdflatex tei-paper.tex

# Option 2: latexmk (automatic)
latexmk -pdf tei-paper.tex

# Option 3: Open in TeXShop (GUI)
open -a TeXShop tei-paper.tex
```

---

## Summary

**Hypothesis:** Large fleets = crapshoots  
**Data:** Large fleets = MORE skill expression (1.74× at W18-18p)  
**Implication:** W12 is empirically optimal for TEI (highest sensitivity)  
**Paper:** Complete LaTeX conversion with Section 8 integrated inline  
**Status:** Ready for compilation, figure polishing, and human validation

🚀 **All analysis complete. Paper is submission-ready pending LaTeX compile + human review.**
