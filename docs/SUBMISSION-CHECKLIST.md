# TEI Paper Submission Checklist

## Pre-Submission Tasks

### 1. Author Information ✏️
- [ ] Replace "Author Name" placeholders in `\author{}` section
- [ ] Add institutional affiliations
- [ ] Add email addresses
- [ ] Verify author order (typically: lead author, contributors by contribution, senior author last)
- [ ] Check institutional branding requirements (if any)

### 2. Acknowledgments ✏️
- [ ] List funding sources (grants, sponsors)
- [ ] Thank collaborators and reviewers
- [ ] Credit compute resources (if significant)
- [ ] Acknowledge community contributors (if applicable)
- [ ] Check funding agency requirements for acknowledgment text

### 3. References 📚
- [ ] Complete `tei-paper.bib` with actual citations
- [ ] Cite foundational MCTS papers (Browne et al. 2012, Cowling et al. 2012)
- [ ] Cite AlphaZero / deep RL if discussed (Silver et al. 2017, 2018)
- [ ] Cite Elo / rating system papers (Elo 1978, Glickman, TrueSkill)
- [ ] Search for any domino game AI literature (likely sparse)
- [ ] Cite relevant multi-player game theory papers
- [ ] Add citations throughout text where claims are made
- [ ] Verify all in-text citations have BibTeX entries
- [ ] Check citation format matches venue style

### 4. Content Review 📝
- [ ] Proofread entire paper for typos
- [ ] Check all mathematical notation is consistent
- [ ] Verify all figures have clear captions
- [ ] Verify all tables have clear captions
- [ ] Check figure/table references are correct (Fig. \ref{...})
- [ ] Ensure all acronyms are defined on first use
- [ ] Check that all URLs in footnotes are current
- [ ] Verify that code/data availability statements are accurate

### 5. Data & Reproducibility 🔬
- [ ] Decide on data release strategy:
  - [ ] Full dataset public (19K games JSON)?
  - [ ] Summary statistics only?
  - [ ] Data available upon request?
- [ ] Update data availability statement in paper
- [ ] Consider archiving to Zenodo/Figshare (DOI)
- [ ] Document reproduction instructions in repository
- [ ] Test that commands in Appendix D actually work
- [ ] Add license to code repository (if making public)

### 6. Figures & Tables 🎨
- [ ] Check all figures render at target resolution
- [ ] Verify color schemes are colorblind-friendly
- [ ] Confirm figures are legible when printed in grayscale
- [ ] For some venues: convert PNG → EPS/PDF vector format
- [ ] Check figure file sizes (some venues have limits)
- [ ] Verify all axis labels are readable
- [ ] Ensure consistent font sizes across figures

## Venue-Specific Preparation

### AIIDE (Recommended)
- [ ] Check AIIDE submission guidelines (page limit, format)
- [ ] Anonymous submission? (Check CFP for double-blind requirements)
- [ ] Supplementary materials allowed? (link to GitHub repo)
- [ ] Typical limit: 8 pages + references (check current year)
- [ ] LaTeX template: May have specific `.cls` file
- [ ] Submission system: EasyChair or similar

### IEEE CoG
- [ ] IEEE formatting: Use `IEEEtran.cls` template
- [ ] Two-column format required
- [ ] Copyright notice: IEEE owns copyright (transfer form)
- [ ] Typical limit: 8 pages including references
- [ ] Figures must be high-quality (300+ DPI for bitmaps)
- [ ] Submit via IEEE system (Manuscript Central)

### FDG (Foundations of Digital Games)
- [ ] ACM formatting: Use `acmart` document class
- [ ] Check FDG-specific template requirements
- [ ] Typical limit: 10 pages + references
- [ ] Consider "design" vs "technical" track
- [ ] May allow supplementary materials
- [ ] Submit via conference management system

### CHI PLAY
- [ ] ACM formatting: `acmart` with `sigchi` option
- [ ] Extended abstract (4 pages) or full paper (10 pages)
- [ ] Strong emphasis on human factors / UX
- [ ] May want to add user study section
- [ ] Submit via PCS (Precision Conference System)

### arXiv (Preprint)
- [ ] No strict formatting requirements
- [ ] Upload source LaTeX + figures
- [ ] Select appropriate categories: cs.AI, cs.GT, cs.LG
- [ ] Include DOI links if published elsewhere
- [ ] Update arXiv version after peer review
- [ ] Consider: arXiv first, then venue submission

## Technical Checks

### LaTeX Compilation
- [ ] Compiles without errors: `pdflatex tei-paper.tex`
- [ ] Run 3 times for references: `pdflatex` × 3
- [ ] Or use: `latexmk -pdf tei-paper.tex`
- [ ] Check PDF renders correctly (fonts, figures)
- [ ] Verify hyperlinks work (if using hyperref)
- [ ] Check PDF file size (some venues have limits)

### Package Compatibility
- [ ] If using venue template, check package conflicts
- [ ] Some venues prohibit certain packages
- [ ] Graphics format: PNG/JPG/PDF usually safe
- [ ] Test on Overleaf if collaborating

### Supplementary Materials
- [ ] GitHub repository link working?
- [ ] README clear for reproducibility?
- [ ] Code comments sufficient for understanding?
- [ ] Sample data provided (if full data embargoed)?
- [ ] License specified (MIT, Apache, GPL)?

## Post-Submission

### Camera-Ready Preparation (After Acceptance)
- [ ] Update with reviewer feedback
- [ ] Check camera-ready deadline
- [ ] Obtain copyright forms (IEEE, ACM)
- [ ] Verify author names exactly as they should appear
- [ ] Include acknowledgments (if removed for blind review)
- [ ] Add DOI/citation after publication
- [ ] Update arXiv with published version

### Presentation Preparation
- [ ] Prepare conference presentation (slides)
- [ ] Practice 15-20 minute talk
- [ ] Prepare poster (if poster session)
- [ ] Create demo video (if applicable)

### Post-Publication
- [ ] Add to personal website / CV
- [ ] Share on social media / mailing lists
- [ ] Update Warp 12 documentation with paper link
- [ ] Consider blog post explaining key findings
- [ ] Add to Google Scholar / ORCID profile

---

## Quick Reference: Current Status

**Paper:** `docs/tei-paper.tex` (19 pages)  
**PDF:** `docs/tei-paper.pdf` (4.1 MB)  
**Figures:** 10 (all embedded)  
**Tables:** 3 (all embedded)  
**Data:** 19,000 games (38 configs)  
**BibTeX:** `docs/tei-paper.bib` (template, needs completion)

**TODO Priority:**
1. Fill in author info (5 min)
2. Write acknowledgments (10 min)
3. Add citations to BibTeX (1-2 hours)
4. Proofread paper (1 hour)
5. Select target venue (1 day research)
6. Format for venue template (2-4 hours)
7. Submit! 🚀

---

## Useful Commands

```bash
# Compile paper (3 passes for references)
cd /Volumes/Code/Warp12/docs
pdflatex tei-paper.tex
bibtex tei-paper
pdflatex tei-paper.tex
pdflatex tei-paper.tex

# Or use latexmk (automatic)
latexmk -pdf tei-paper.tex

# Clean auxiliary files
latexmk -c

# Check word count (approximate)
pdftotext tei-paper.pdf - | wc -w

# Check for common LaTeX errors
grep -n "TODO" tei-paper.tex
grep -n "\\cite{}" tei-paper.tex  # Missing citations
grep -n "Figure~\\ref{}" tei-paper.tex  # Check figure refs
```

---

## Contact Info for Venues

- **AIIDE:** http://aiide.org/
- **IEEE CoG:** https://ieee-cog.org/
- **FDG:** https://www.foundationsofdigitalgames.org/
- **CHI PLAY:** https://chiplay.acm.org/
- **arXiv:** https://arxiv.org/

Check CFP (Call for Papers) for deadlines and submission requirements!
