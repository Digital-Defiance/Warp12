# TEI Paper: Ready for Submission

## ✅ What's Complete

### Paper Structure
- **19 pages** of LaTeX content
- **10 sections** (Introduction → Conclusion)
- **4 appendices** (Figures, Tables, Code Map, Reproducibility)
- **10 embedded figures** (publication-quality PNG)
- **3 embedded tables** (LaTeX format)
- **Abstract** (200 words, complete)
- **Placeholder references** (5 foundational citations)

### Data & Analysis
- **19,000 games** collected (38 configurations)
- **Statistical analysis** complete (ANOVA, correlations, effect sizes)
- **Key finding:** Skill increases with fleet size (contradicts intuition)
- **W18 @ 18p:** Highest skill/luck ratio (8.10) - NOT a crapshoot
- **All figures generated** from empirical data

### Files Created
```
docs/
  tei-paper.tex           # Main LaTeX source (complete)
  tei-paper.pdf           # Compiled output (4.1 MB, 19 pages)
  tei-paper.bib           # BibTeX template (needs completion)
  SUBMISSION-CHECKLIST.md # Step-by-step submission guide
  READY-FOR-SUBMISSION.md # This file
  
tools/nn/
  figures/                # 10 PNG figures
  tables/                 # 3 LaTeX tables
  data/                   # 19K games + processed data
```

---

## ⏳ What Needs Completion (30-60 minutes)

### 1. Author Information (5 minutes)
**File:** `docs/tei-paper.tex` (lines 14-25)

**Current:**
```latex
\author{
  Author Name\textsuperscript{1,2} \and
  Author Name\textsuperscript{1} \and
  Author Name\textsuperscript{3}
}
```

**Replace with:**
```latex
\author{
  Your Name\textsuperscript{1} \and
  Collaborator Name\textsuperscript{2}
}

\textsuperscript{1}Your Institution, Department \\
\textsuperscript{2}Their Institution \\
\texttt{\{your.email, their.email\}@domain.edu}
```

### 2. Acknowledgments (10 minutes)
**File:** `docs/tei-paper.tex` (line 633)

**Current:** Template with TODOs

**Example:**
```latex
This work was supported by NSF Grant #XXXXXX. We thank the 
open-source community for contributions to the Warp 12 engine.
Computational resources were provided by [institution]. Special 
thanks to [beta testers] for feedback on game mechanics.
```

### 3. Citations (1-2 hours)
**File:** `docs/tei-paper.bib`

**Status:** Template with 5 foundational papers (MCTS, AlphaZero, Elo)

**TODO:**
- Search Google Scholar for:
  - "domino games AI" (likely sparse)
  - "multi-player game AI"
  - "self-play reinforcement learning"
  - "skill rating systems"
- Add 10-20 relevant citations
- Add `\cite{...}` commands throughout text where appropriate

**Key places needing citations:**
- Section 2 (Related Work) - each paragraph
- Section 4 (Agent Architecture) - MCTS/ISMCTS references
- Section 5 (TEI) - Elo/Glickman/TrueSkill
- Section 8 (Discussion) - any strong claims

---

## 🎯 Submission Strategy

### Recommended Venue: **AIIDE 2027**

**Why AIIDE?**
- Best fit for game AI + empirical evaluation
- Values practical AI systems with real deployment
- Appreciates reproducible research (GitHub, data)
- Page limit (8-10) matches our content scope
- Community values product-oriented AI design

**Timeline:**
1. Complete author/acknowledgments/citations (1 day)
2. Proofread and polish (1 day)
3. Format to AIIDE template (0.5 day)
4. Internal review (1 week)
5. Submit before AIIDE deadline (typically June)

### Alternative Venues

**IEEE CoG (Conference on Games):**
- Pros: Broader games audience, IEEE prestige
- Cons: Requires IEEE template (2-column)
- Timeline: Similar to AIIDE

**arXiv Preprint:**
- Pros: Immediate publication, no review delay
- Cons: Not peer-reviewed (supplement, not replacement)
- Strategy: Post to arXiv, then submit to conference

**FDG (Foundations of Digital Games):**
- Pros: Design-focused audience
- Cons: May need to emphasize UX/design aspects more

---

## 📋 Quick Start: Complete in 1 Hour

### Step 1: Author Info (5 min)
```bash
# Edit docs/tei-paper.tex lines 14-25
# Replace "Author Name" with actual names
# Add affiliations and emails
```

### Step 2: Acknowledgments (10 min)
```bash
# Edit docs/tei-paper.tex line 633
# Replace TODO template with actual acknowledgments
```

### Step 3: Key Citations (30 min)
```bash
# Add these specific citations throughout text:

# Section 2.2: MCTS
Add: "Monte Carlo Tree Search \cite{browne2012mcts} ..."

# Section 4: ISMCTS
Add: "Information Set MCTS \cite{cowling2012ismcts} ..."

# Section 5: Elo
Add: "Standard Elo rating \cite{elo1978rating} ..."

# Section 7: AlphaZero comparison
Add: "Unlike AlphaZero \cite{silver2017alphazero} ..."
```

### Step 4: Compile (5 min)
```bash
cd /Volumes/Code/Warp12/docs
pdflatex tei-paper.tex
bibtex tei-paper
pdflatex tei-paper.tex
pdflatex tei-paper.tex
```

### Step 5: Proofread (10 min)
- Read abstract out loud
- Check figure captions
- Verify all sections flow logically

---

## 🚀 Commands Reference

### Compile Paper
```bash
cd /Volumes/Code/Warp12/docs

# Full compile (3 passes)
pdflatex tei-paper.tex
bibtex tei-paper
pdflatex tei-paper.tex
pdflatex tei-paper.tex

# Or use latexmk (automatic)
latexmk -pdf tei-paper.tex

# Clean auxiliary files
latexmk -c
```

### Check Paper Stats
```bash
# Word count (approximate)
pdftotext tei-paper.pdf - | wc -w

# Find TODOs
grep -n "TODO" tei-paper.tex

# Check missing citations
grep -n "\\cite{}" tei-paper.tex
```

### Export for Submission
```bash
# Create submission package
mkdir tei-paper-submission
cp tei-paper.tex tei-paper-submission/
cp tei-paper.bib tei-paper-submission/
cp -r ../tools/nn/figures tei-paper-submission/
cp -r ../tools/nn/tables tei-paper-submission/
zip -r tei-paper-submission.zip tei-paper-submission/
```

---

## 📊 Paper Highlights (for Abstract/Summary)

**Novel Contributions:**
1. **19,000-game empirical study** across 4 Warp factors × 38 configurations
2. **Counter-intuitive finding:** Skill expression INCREASES with fleet size (r=0.84-0.89)
3. **W18 @ 18p is NOT a crapshoot:** 1.74× skill vs 2p, highest skill/luck ratio (8.10)
4. **W12 empirically optimal** for rating: highest sensitivity to player count (r=0.875)
5. **Dual-track TEI:** Independent points/go-out ratings with fixed AI reference bands
6. **Ω self-play policy:** Replaces heuristic Commander without separate lobby tier
7. **Multi-engine routing:** Expectimax for 2p, ISMCTS for 3p+ (mode-dependent search)

**Key Results:**
- ANOVA: Warp factor effect F=817.14, p<0.001, η²=0.290 (large effect)
- Fleet size: r=0.875 (W12), r=0.893 (W15), r=0.840 (W18) - all p<0.001
- Decision complexity constant (~2 moves/turn) despite 4× tile count variation
- Hand entropy increases W9→W18: 2.09 → 2.66 bits

---

## ✉️ Next Steps

1. **Today:** Fill in author info and acknowledgments
2. **This week:** Complete citations and proofread
3. **Next week:** Format for target venue
4. **Submit:** Before conference deadline

**Questions?** Check `SUBMISSION-CHECKLIST.md` for detailed guidance.

**Ready to submit?** You're 1 hour of editing away from a complete paper! 🎉
