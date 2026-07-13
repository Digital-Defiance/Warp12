# TEI Grade System
**Gamified Presentation Layer for OpenSkill Ratings with Hysteresis**

## Overview

The TEI Grade System is a gamified presentation layer built on top of OpenSkill's Bayesian rating system. It transforms raw (μ, σ) tuples into an engaging **"E97"** format that creates dual progression goals and visible feedback loops.

**Key Feature:** Hysteresis prevents boundary flickering by using different thresholds for entering vs. exiting each grade.

## Format: "E97"

### The Letter Grade (σ → Confidence)

The letter represents **data confidence** — how certain the system is about the player's skill estimate:

| **σ Range**              | **Grade** | **Name**       | **Meaning**                                    | **Enter** | **Exit** |
| ------------------------ | --------- | -------------- | ---------------------------------------------- | --------- | -------- |
| σ < 0.5 (raw)            | **E**     | Elite          | Massive sample size, anchored rating           | σ < 0.4   | σ > 0.6  |
| 0.5 ≤ σ < 1.5 (raw)      | **V**     | Veteran        | Highly reliable skill estimate                 | σ < 1.4   | σ > 1.6  |
| 1.5 ≤ σ < 2.5 (raw)      | **C**     | Consistent     | Reliable estimate with room to drift           | σ < 2.4   | σ > 2.6  |
| 2.5 ≤ σ < 4.0 (raw)      | **I**     | Improving      | Recent changes or lower sample size            | σ < 3.8   | σ > 4.2  |
| σ ≥ 4.0 (raw)            | **P**     | Provisional    | Insufficient data, still establishing          | —         | —        |

**Hysteresis:** "Enter" is the threshold to upgrade TO this grade (from worse). "Exit" is the threshold to downgrade FROM this grade (to worse). The ~0.2σ gap between adjacent boundaries creates a "deadband" preventing flickering.

### The Number Score (μ → Skill)

The number (0-99) represents **normalized skill** using a conservative estimate to prevent "new player inflation":

```typescript
conservativeEstimate = μ - 3σ
score = clamp(normalize(conservativeEstimate, [minMu, maxMu]) * 99, 0, 99)
```

**Default calibration:**
- `minMu = 10.0` (beginner floor with -3σ buffer)
- `maxMu = 50.0` (elite ceiling, well above Commander's μ=35)

**Examples:**
- **Commander anchor:** μ=35, σ=3.0 → D=26 → score ≈ 40 → **I40**
- **Lieutenant anchor:** μ=26.5, σ=3.5 → D=16 → score ≈ 15 → **I15**  
- **Ensign anchor:** μ=18, σ=4.0 → D=6 → score = 0 (clamped) → **P00**
- **Elite player:** μ=40, σ=0.4 → D=38.8 → score ≈ 71 → **E71**

## Hysteresis Implementation

**Problem:** Without hysteresis, players at grade boundaries (e.g., σ ≈ 1.5) can flicker between adjacent grades (V ↔ C) on every match, creating a frustrating UX.

**Solution:** Each grade has different entry and exit thresholds with a ~0.2σ "deadband":

```typescript
// Example: C grade boundaries
const C_boundaries = {
  enter: 2.4,  // Must drop below σ=2.4 to enter C from I
  exit: 2.6,   // Must rise above σ=2.6 to exit C to I
};

// Player at C with σ = 2.5 stays at C (within deadband)
// Player at C with σ = 2.35 upgrades to V (crossed V enter threshold 1.4)
// Player at C with σ = 2.65 downgrades to I (crossed C exit threshold 2.6)
```

**Storage:** The `displayGrade` field is stored alongside `mu`, `sigma` in Firestore:

```typescript
interface StoredRating {
  mu: number;
  sigma: number;
  matches: number;
  displayRating: number;        // Cached μ - 3σ
  displayGrade?: TeiGrade;      // Last displayed grade (E/V/C/I/P) for hysteresis
}
```

**First Calculation:** New players (no `displayGrade`) use raw thresholds without hysteresis:
- σ < 0.5 → E
- 0.5 ≤ σ < 1.5 → V
- 1.5 ≤ σ < 2.5 → C
- 2.5 ≤ σ < 4.0 → I
- σ ≥ 4.0 → P

After the first rating update, `displayGrade` is saved and subsequent calculations use hysteresis.

## Why This Works

### 1. Dual Progression Goals
Players don't just grind the **number** (skill); they also grind the **letter** (confidence). This creates two independent axes of improvement:
- **Skill progression:** Win games to increase μ → higher score
- **Confidence progression:** Play consistently to decrease σ → better grade

A player with **I40** has the same skill estimate as **C40**, but C40 has more experience and stability.

### 2. Module Experimentation Feedback
When a player tries a new module/ruleset, OpenSkill spikes their σ because the system hasn't seen them perform under those conditions. This creates **visible feedback**:

**Before:** E84 (μ=45, σ=0.4 — elite, 500 games)  
**After new module:** I68 (μ=45, σ=3.5 — same skill, but system re-evaluating)

The grade drop from E→I is a **feature, not a bug**. It tells the player: *"Your established rating is under re-evaluation with this new module."*

### 3. Prevents New Player Inflation
Using μ - 3σ as the conservative estimate ensures new players (high σ) don't get artificially inflated scores. A new player with μ=25, σ=8.33 gets:
- Conservative: 25 - 25 = 0 → **P00**
- Not: μ=25 → score 37 (misleading!)

### 4. Gamifies Uncertainty
Instead of hiding σ as "technical complexity," we make it a **visible progression mechanic**:
- P → I → C → V → E becomes a ladder to climb
- Players understand: "I need more games to reach Veteran"
- Tooltips explain: "Your rating is still establishing"

## Implementation

### Core Functions

```typescript
import { getTeiDisplay } from 'warp12-engine';

const rating = { mu: 32.0, sigma: 1.2, matches: 150 };
const currentGrade = 'V'; // From previous calculation (stored in Firestore)

const tei = getTeiDisplay(rating, currentGrade);
// { grade: 'V', score: 67, formatted: 'V67' }

// If this is the FIRST calculation (new player):
const teiNew = getTeiDisplay(rating, undefined);
// Uses raw thresholds without hysteresis
```

**Available functions:**
- `getTeiGrade(sigma, currentGrade?)` — Get letter grade from σ with hysteresis
- `getTeiScore(rating, config?)` — Get 0-99 score from rating
- `getTeiDisplay(rating, currentGrade?, config?)` — Get complete {grade, score, formatted}
- `isTeiProvisional(rating)` — Check if P grade (σ ≥ 4.0)
- `getTeiGradeName(grade)` — "Elite", "Veteran", etc.
- `getTeiGradeDescription(grade)` — Tooltip text
- `getTeiGradeColor(grade)` — CSS class suffix for theming
- `previewTeiChange(rating, currentGrade, won)` — Estimate TEI change after match

### UI Integration (Phase 3)

**RatingDisplay Component:**
```tsx
<div className="tei-display">
  <span className={`tei-grade tei-grade--${color}`}>{grade}</span>
  <span className="tei-score">{score}</span>
  <Tooltip>
    {gradeName}: {gradeDescription}
    <br />
    μ = {mu.toFixed(1)}, σ = {sigma.toFixed(1)}
  </Tooltip>
</div>
```

**Theming:**
- **E** (Elite): Gold/yellow (#FFD700)
- **V** (Veteran): Blue (#4169E1)
- **C** (Consistent): Green (#32CD32)
- **I** (Improving): Orange (#FFA500)
- **P** (Provisional): Gray (#9E9E9E)

## Engineering Philosophy

### "Honest Math, Smoothed UI"

The backend **always** stores raw (μ, σ) values with full precision. The TEI Grade is a **presentation layer** — a lens that shows the "trend line" of skill rather than the noise of individual matches.

**Backend (Firebase):**
```typescript
{
  rating: {
    mu: 32.157,
    sigma: 1.234,
    matches: 147,
    displayRating: 28.455
  }
}
```

**Frontend (Display):**
```typescript
"V67"  // Gamified, user-friendly
```

### Optional: Hysteresis for Grade Stability

If grade flickering becomes an issue (e.g., bouncing between C/I at σ≈2.5), implement hysteresis:

- **To upgrade C→V:** Maintain σ < 1.4 for 5 games
- **To downgrade C→I:** Maintain σ > 2.6 for 3 games

This creates a "deadband" around boundaries, forcing the UI to "commit" to a grade change.

**Not implemented yet** — monitor user feedback in Phase 3 testing before adding complexity.

## Testing

**37 tests in `tei-grade.spec.ts`:**
- ✅ Grade mapping (σ → letter with raw thresholds)
- ✅ Hysteresis boundaries (enter vs exit thresholds, ~0.2σ deadband)
- ✅ Score calculation (μ - 3σ → 0-99)
- ✅ Clamping edge cases
- ✅ AI anchor formatting (Commander → I40, etc.)
- ✅ Progression tension mechanics (module experimentation spikes σ)
- ✅ Preview functionality (estimate TEI after win/loss with hysteresis)

**Hysteresis Test Coverage:**
- Prevents V↔C flickering at σ ≈ 1.5
- Prevents C↔I flickering at σ ≈ 2.5
- Prevents I↔P flickering at σ ≈ 4.0
- Creates ~0.2σ deadband at each boundary
- Allows large σ changes to cross multiple grades
- Treats undefined currentGrade as new player (no hysteresis)

## Examples

### Typical Player Progression

**Week 1 (5 games):**
- μ=25.0, σ=6.5, matches=5
- Conservative: 25 - 19.5 = 5.5 → score ≈ 0
- **P00** — Still establishing

**Week 4 (25 games):**
- μ=28.0, σ=3.8, matches=25
- Conservative: 28 - 11.4 = 16.6 → score ≈ 16
- **I16** — Improving, gaining confidence

**Month 3 (80 games):**
- μ=30.0, σ=2.3, matches=80
- Conservative: 30 - 6.9 = 23.1 → score ≈ 33
- **C33** — Consistent performance established

**Month 6 (200 games):**
- μ=32.5, σ=1.3, matches=200
- Conservative: 32.5 - 3.9 = 28.6 → score ≈ 46
- **V46** — Veteran, highly reliable

**Year 1 (500 games):**
- μ=35.0, σ=0.8, matches=500
- Conservative: 35 - 2.4 = 32.6 → score ≈ 56
- **V56** — Still climbing skill, locked in Veteran

**Year 2 (800 games, tries new module):**
- μ=35.0, σ=3.2, matches=820
- Conservative: 35 - 9.6 = 25.4 → score ≈ 38
- **I38** — Temporarily dropped to Improving! Re-evaluation with new module.

**Year 2 (after 50 more module games):**
- μ=36.5, σ=1.2, matches=870
- Conservative: 36.5 - 3.6 = 32.9 → score ≈ 57
- **V57** — Back to Veteran, skill increased from module practice

## Future Enhancements

### Possible Additions (Post-Launch):
1. **EMA smoothing** — Exponential moving average for score display (reduce score jitter, complementary to grade hysteresis)
2. **Grade change animations** — Celebrate promotions (I→C, C→V, etc.)
3. **Achievement system** — "First E grade", "Veteran in both objectives", etc.
4. **Historical grade tracking** — Graph showing grade progression over time
5. **Module-specific grades** — "E84 (Standard), I52 (Module Alpha)" for granularity

### What NOT to Add:
- ❌ **Don't show raw μ/σ as primary numbers** — Keep them in tooltips only
- ❌ **Don't let players manually set their grade** — It's derived from data
- ❌ **Don't average grades** — Grades are ordinal, not numeric (E + I ≠ 2×C)
- ❌ **Don't add more hysteresis complexity** — Current ~0.2σ deadband is sufficient

## References

- **Implementation:** `libs/engine/src/lib/rating/tei-grade.ts`
- **Tests:** `libs/engine/src/lib/rating/tei-grade.spec.ts`
- **OpenSkill:** `libs/engine/src/lib/rating/openskill-adapter.ts`
- **Calibration:** `docs/openskill-calibration-log.md`
- **TODO:** `docs/OPENSKILL-ZETA-TODO.md` (Phase 3 UI integration)

---

**Status:** ✅ Implementation complete with hysteresis, ready for Phase 3 UI integration  
**Tests:** ✅ 37/37 passing (includes hysteresis test coverage)  
**Build:** ✅ Engine builds successfully  
**Hysteresis:** ✅ Implemented with ~0.2σ deadbands at all grade boundaries



=== TEI GRADE BANDS FOR ACADEMY PLACEMENT ===

Ensign (New to dominoes):
  P00 (absolute beginner):
    μ=13.3, σ=8.3, TEI=P0
  P15 (learning):
    μ=16.0, σ=6.0, TEI=P0
  I22 (early improvement):
    μ=20.0, σ=3.5, TEI=I0
  I25 (upper Ensign):
    μ=21.5, σ=3.5, TEI=I2

Lieutenant (Knows multi-trail):
  I28 (entering Lieutenant):
    μ=22.5, σ=3.0, TEI=I9
  C38 (consistent performance):
    μ=25.5, σ=2.3, TEI=C21
  C45 (upper Lieutenant):
    μ=28.0, σ=2.0, TEI=C30

Commander (Seasoned strategist):
  C52 (entering Commander):
    μ=30.5, σ=1.8, TEI=C37
  V63 (veteran skill):
    μ=35.5, σ=1.3, TEI=V53
  V70 (upper Commander):
    μ=38.0, σ=1.0, TEI=V62

Beyond Commander (Elite):
  E76 (elite player):
    μ=40.5, σ=0.4, TEI=E73

=== AI ANCHORS ===

Ensign (Points):     C5 (μ=18, σ=2)
Lieutenant (Points): C27 (μ=26.5, σ=1.8)
Commander (Points):  C51 (μ=35, σ=1.5)
