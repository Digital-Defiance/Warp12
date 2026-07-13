# OpenSkill Documentation Update TODO

This tracks all documentation files that need updating during the OpenSkill migration.
User request: "we'll also need to update all of the /Volumes/Code/Warp12/docs and user facing pages related to TEI."

---

## Critical Path (Block deployment)

### Technical Specs (normative)

- [ ] **`tei-spec.md`** — COMPLETE REWRITE
  - [ ] §2: Add μ, σ, display rating, ordinal rating terminology
  - [ ] §3: Update rating state (μ, σ tuples instead of integers)
  - [ ] §6: DELETE all Elo formulas, ADD OpenSkill math (factor graphs, Bayesian updates)
  - [ ] §7: Replace TEI anchors with (μ, σ) anchors
  - [ ] §8: New conformance test vectors (OpenSkill examples)
  - [ ] §9: Update leaderboard display (display rating = μ - 3σ)
  - [ ] §10: Update mixed tables (AI anchors fixed)
  - [ ] §11: Rewrite worked examples with OpenSkill math
  - **Priority:** HIGH (Phase 4.1 in TODO)

- [ ] **`tei-rating.md`** — Update or consolidate into tei-spec
  - [ ] Check what's in this file (might be duplicate of tei-spec)
  - [ ] Update if needed, or point to tei-spec.md

### Research Paper (publication quality)

- [ ] **`tei-paper.tex`** — MAJOR REVISION
  - [ ] Abstract: Replace "Elo-style" with "OpenSkill Bayesian rating"
  - [ ] §1 Introduction: Update TEI description
  - [ ] §2 Related Work: Add TrueSkill, OpenSkill, Weng-Lin citations
  - [ ] §5 TEI Rating System: COMPLETE REWRITE
    - [ ] §5.1: OpenSkill model (μ, σ, display rating)
    - [ ] §5.2: Reference bands (now μ±σ, not integers)
    - [ ] §5.3: Update rules (Bayesian, not K-factor)
    - [ ] §5.4: Percentile boards (logic unchanged)
  - [ ] §6 Calibration: Update to reference OpenSkill anchor calibration
  - [ ] §7 Results: Replace "ΔTEI" with "Δμ" in tables
  - [ ] §8 Luck vs Skill: Update axis labels if needed
  - [ ] §9 Discussion: Update with OpenSkill lessons
  - [ ] §10 Conclusion: Mention unified FFA + team rating
  - [ ] Bibliography: Add OpenSkill, TrueSkill citations
  - **Priority:** HIGH (Phase 4.2 in TODO)

- [ ] **`tei-paper.bib`** — Add citations
  - [ ] OpenSkill paper/repo
  - [ ] TrueSkill (Microsoft Research)
  - [ ] Weng-Lin Bayesian skill rating papers

### Figures & Tables

- [ ] **Figure 6** (TEI ladder) — Regenerate
  - [ ] Show μ±σ error bars instead of fixed integers
  - [ ] Update caption
  - [ ] Source: `tools/nn/figures/figure6-tei-ladder.png`

- [ ] **Figure 10** (points vs go-out) — Update labels
  - [ ] "Implied Δμ" instead of "Implied ΔTEI"
  - [ ] Otherwise keep same data/trends

- [ ] **Table 1** (reference bands) — Regenerate
  - [ ] Show μ, σ, display rating for each class
  - [ ] Both tracks (points, go-out)

- [ ] **Figure generation scripts**
  - [ ] Update `tools/nn/create-figures.py` to read OpenSkill data
  - [ ] Regenerate all rating-related figures

---

## User-Facing Documentation (user experience)

### Core Rules & Guides

- [ ] **`RULES.md`** — §VIII TEI/Rating section
  - [ ] Simplify for users: "Your rating is μ - 3σ"
  - [ ] Explain provisional badge (high uncertainty)
  - [ ] Update terminology (keep "TEI" brand or switch to "Rating"?)
  - [ ] Module Zeta: explain team rating
  - **Priority:** HIGH (user-facing)

- [ ] **`README.md`** — Main project README
  - [ ] §2 Tech Stack: Update rating system description
  - [ ] Replace Elo references with OpenSkill
  - [ ] Update "Rating System" section
  - **Priority:** MEDIUM

- [ ] **`AGENTS.md`** — Developer guide
  - [ ] §2: Update tech stack (OpenSkill)
  - [ ] §VIII TEI: Update for developers
  - [ ] Add note on rating module in engine
  - **Priority:** MEDIUM (developer-facing)

### Supporting Documentation

- [ ] **`calibration-log.md`** — Calibration history
  - [ ] Add OpenSkill calibration entry
  - [ ] Document anchor tuning process
  - [ ] Keep old Elo calibration for historical reference
  - **Priority:** MEDIUM (Phase 1.3 output)

- [ ] **`tei-paper-outline.md`** — Outline doc
  - [ ] Update to reflect OpenSkill changes
  - [ ] Or mark as historical (Elo version)
  - **Priority:** LOW

- [ ] **`research.md`** — Research overview
  - [ ] Update rating system section
  - [ ] Link to new OpenSkill papers/refs
  - **Priority:** LOW

### Module-Specific Docs

- [ ] **`module-rating-analysis.md`** — Module Zeta rating analysis
  - [ ] Update Option 3 section (chosen path)
  - [ ] Mark as "implemented" after Phase 5
  - **Priority:** MEDIUM

- [ ] **`unimplemented-modules.md`** — Module status
  - [ ] Remove Zeta from unimplemented after Phase 5
  - [ ] Update status tracking
  - **Priority:** LOW

### Migration & Guides

- [ ] **Create `openskill-migration-guide.md`**
  - [ ] For third-party implementers
  - [ ] How to migrate from Elo TEI v1 to OpenSkill TEI v2
  - [ ] Breaking changes, schema updates
  - **Priority:** MEDIUM (Phase 7)

- [ ] **Create `openskill-calibration-log.md`**
  - [ ] Results from Phase 1.3 anchor calibration
  - [ ] Iteration history, final win rates
  - [ ] Comparison to Elo anchors
  - **Priority:** HIGH (Phase 1.3 output)

---

## Website / UI Content (leaderboard app)

These are in the main repo, not `/docs`:

- [ ] **`apps/Warp12/src/content/*.md`** — In-app content
  - [ ] Check for TEI/rating references
  - [ ] Update glossary entries
  - [ ] Update FAQs

- [ ] **Leaderboard app** (`Warp12-leaderboard/`)
  - [ ] "About TEI" page → update with OpenSkill
  - [ ] Rating calculator → use OpenSkill math
  - [ ] FAQs → explain μ, σ, display rating
  - **Priority:** HIGH (Phase 7)

---

## Archive / Historical Docs

These may not need updates (historical reference):

- [ ] **`tei-paper-section8.md`** — Section 8 draft
  - [ ] Decision: Keep as Elo version or update?

- [ ] **`omega-*.md`** — Neural training docs
  - [ ] Likely unchanged (training process same)
  - [ ] But anchor values will change

- [ ] **`luck-skill-experimental-design.md`** — Study design
  - [ ] Unchanged (measured game properties, not rating math)

- [ ] **`luck-vs-skill-analysis.md`** — Analysis results
  - [ ] Unchanged (complexity metrics, not ratings)

- [ ] **`mexican-train-*.md`** — Multi-trail rules
  - [ ] Unchanged (game rules, not ratings)

---

## Checklist by Phase

### Phase 1.3 (Anchor Calibration)
- [ ] Create `openskill-calibration-log.md`
- [ ] Update `calibration-log.md` with new entry

### Phase 2 (Backend Integration)
- [ ] Update internal code docs (function comments, etc.)

### Phase 3 (UI/UX)
- [ ] Update in-app content (`apps/Warp12/src/content/`)
- [ ] Update help text, tooltips

### Phase 4 (Documentation)
- [ ] `tei-spec.md` §2-11 complete rewrite
- [ ] `tei-paper.tex` §1-2, §5-6, §9-10 rewrite
- [ ] `tei-paper.bib` add citations
- [ ] Regenerate all figures
- [ ] `RULES.md` §VIII update
- [ ] `README.md` update
- [ ] `AGENTS.md` update
- [ ] `calibration-log.md` update
- [ ] Create `openskill-migration-guide.md`

### Phase 5 (Module Zeta)
- [ ] Update `module-rating-analysis.md` (mark implemented)
- [ ] Update `unimplemented-modules.md` (remove Zeta)
- [ ] Add Zeta examples to `RULES.md`

### Phase 6 (Testing)
- [ ] No doc changes (test execution)

### Phase 7 (Deployment)
- [ ] Leaderboard app content updates
- [ ] Final review of all user-facing docs
- [ ] Publish updated paper PDF

---

## Priority Order

### Must-Do Before Launch
1. `tei-spec.md` (normative reference)
2. `RULES.md` §VIII (user-facing)
3. `tei-paper.tex` + figures (publication)
4. Leaderboard app content

### Should-Do Before Launch
5. `README.md` (project overview)
6. `AGENTS.md` (developer guide)
7. `calibration-log.md` (historical record)
8. `openskill-migration-guide.md` (third-party support)

### Nice-to-Have
9. Update all module docs
10. Archive old Elo versions
11. Update research overviews

---

## Search & Replace Candidates

These terms appear frequently and may need global updates:

| Old Term | New Term | Context |
|----------|----------|---------|
| "TEI" | "Rating" or "Skill Rating" | User-facing (or keep "TEI" as brand?) |
| "1450" | "23.5" | Example rating values |
| "K-factor" | "uncertainty decay" | Technical explanation |
| "ΔTEI" | "Δμ" | Paper tables, technical docs |
| "Elo" | "OpenSkill" | Where describing rating system |
| "expectedEloScore" | "Bayesian inference" | Technical implementation |

**Decision needed:** Keep "TEI" as the brand name (Tactical Effectiveness Index) but explain it's now OpenSkill-based? Or fully rebrand to "Skill Rating"?

---

## Documentation Verification Checklist

Before marking complete, verify:
- [ ] All code examples use OpenSkill types (μ, σ, not TEI integers)
- [ ] All figures show correct data (μ±σ error bars where appropriate)
- [ ] All references to "Elo" updated to "OpenSkill" (where accurate)
- [ ] No broken links (especially to renamed/moved files)
- [ ] Consistent terminology across all docs
- [ ] User-facing language is simple (hide complexity)
- [ ] Technical docs are precise (show full math)

---

**Status:** Not started (waiting for Phase 1.3 completion)  
**Owner:** Phase 4 in OPENSKILL-ZETA-TODO.md  
**Estimated effort:** 2-3 days (after calibration complete)
