# TEI Grade Hysteresis Implementation

## Summary

Hysteresis has been **fully implemented** in the TEI Grade system to prevent boundary flickering.

## What Was Implemented

### 1. Grade Boundaries with Deadbands

Each grade has different entry and exit thresholds:

| Grade | Enter (from worse) | Exit (to worse) | Deadband |
|-------|-------------------|-----------------|----------|
| E     | σ < 0.4           | σ > 0.6         | 0.2σ     |
| V     | σ < 1.4           | σ > 1.6         | 0.2σ     |
| C     | σ < 2.4           | σ > 2.6         | 0.2σ     |
| I     | σ < 3.8           | σ > 4.2         | 0.4σ     |
| P     | σ ≥ 3.8           | —               | —        |

### 2. Schema Updates

Added `displayGrade` to `StoredRating`:

```typescript
interface StoredRating {
  readonly mu: number;
  readonly sigma: number;
  readonly matches: number;
  readonly displayRating: number;
  readonly displayGrade?: TeiGrade;  // NEW: For hysteresis tracking
}
```

This field stores the last displayed grade and is used in subsequent calculations to apply hysteresis.

### 3. Function Signatures Updated

```typescript
// Before (no hysteresis)
getTeiGrade(sigma: number): TeiGrade
getTeiDisplay(rating: PlayerRating, config?: TeiScoreConfig): TeiDisplay
previewTeiChange(rating: PlayerRating, won: boolean, config?: TeiScoreConfig): ...

// After (with hysteresis)
getTeiGrade(sigma: number, currentGrade?: TeiGrade): TeiGrade
getTeiDisplay(rating: PlayerRating, currentGrade?: TeiGrade, config?: TeiScoreConfig): TeiDisplay
previewTeiChange(rating: PlayerRating, currentGrade: TeiGrade | undefined, won: boolean, config?: TeiScoreConfig): ...
```

### 4. Hysteresis Logic

The `getTeiGrade()` function now:

1. **For new players** (`currentGrade === undefined`): Uses raw thresholds (0.5, 1.5, 2.5, 4.0) without hysteresis
2. **For existing players**: 
   - Scans from best to worst grade
   - Checks if σ dropped below the ENTER threshold of a better grade → upgrade
   - Checks if σ rose above the EXIT threshold of current grade → downgrade
   - Otherwise → stay in current grade (within deadband)

### 5. Test Coverage

**37 tests passing**, including 11 hysteresis-specific tests:

- ✅ Prevents V↔C flickering at σ ≈ 1.5
- ✅ Prevents C↔V flickering at boundary  
- ✅ Prevents C↔I flickering at σ ≈ 2.5
- ✅ Prevents I↔C flickering at boundary
- ✅ Prevents I↔P flickering at σ ≈ 4.0
- ✅ Prevents P→I flickering at boundary
- ✅ Allows large σ changes to cross multiple grades
- ✅ Creates ~0.2σ deadband at each boundary
- ✅ Treats undefined currentGrade as new player (no hysteresis)
- ✅ Hysteresis in preview function
- ✅ Grade crossing detection with hysteresis

## Engineering Philosophy

**"Honest Math, Smoothed UI"** — The backend stores raw (μ, σ) with full precision. The displayed grade applies hysteresis as a "low-pass filter" showing the trend rather than noise.

## Example Scenarios

### Scenario 1: Player at Boundary (No Flickering)

```typescript
// Player at C with σ = 2.55 (in deadband between C exit 2.6 and I enter 2.4)
getTeiGrade(2.55, 'C')  // → 'C' (stays, within deadband)
getTeiGrade(2.55, 'I')  // → 'I' (stays, within deadband)

// Same σ, different result depending on current grade = hysteresis working!
```

### Scenario 2: Crossing Threshold

```typescript
// Player at C, σ drops below V enter threshold (1.4)
getTeiGrade(1.38, 'C')  // → 'V' (upgrades, crossed V enter threshold)

// Player at C, σ rises above C exit threshold (2.6)
getTeiGrade(2.65, 'C')  // → 'I' (downgrades, crossed C exit threshold)
```

### Scenario 3: New Player

```typescript
// New player (no history)
getTeiGrade(1.5, undefined)  // → 'C' (uses raw threshold, 1.5 ≤ σ < 2.5)
getTeiGrade(2.5, undefined)  // → 'I' (uses raw threshold, 2.5 ≤ σ < 4.0)
```

## Integration Points

### Functions (Cloud Functions)

When updating ratings after matches, calculate the new grade WITH hysteresis:

```typescript
import { getTeiDisplay } from 'warp12-engine';

// Read old rating from Firestore
const oldRating = playerDoc.rating.goOut;
const oldGrade = oldRating.displayGrade;  // Previous grade (or undefined)

// Calculate new rating with OpenSkill
const newRating = updateFFARatings(...);

// Calculate new TEI display WITH hysteresis
const newTei = getTeiDisplay(newRating, oldGrade);

// Save to Firestore with new displayGrade
await updateDoc(playerRef, {
  'rating.goOut': {
    mu: newRating.mu,
    sigma: newRating.sigma,
    matches: newRating.matches,
    displayRating: newRating.mu - 3 * newRating.sigma,
    displayGrade: newTei.grade,  // Store for next calculation
  },
});
```

### Client (React Components)

When displaying ratings, pass the stored `displayGrade`:

```typescript
import { TeiDisplay } from './components/tei-display';

<TeiDisplay 
  rating={playerStats.rating.goOut}
  currentGrade={playerStats.rating.goOut.displayGrade}  // Pass for consistency
  objective="goOut"
/>
```

Note: The client typically doesn't need to calculate grades (just display what the backend calculated), but if it does (e.g., for predictions), it should use the stored `displayGrade`.

## Files Modified

### Engine (Core Implementation):
- ✅ `libs/engine/src/lib/rating/tei-grade.ts` — Added hysteresis logic
- ✅ `libs/engine/src/lib/rating/tei-grade.spec.ts` — 11 new hysteresis tests
- ✅ `libs/engine/src/lib/rating/index.ts` — Updated exports

### Client Schema:
- ✅ `apps/Warp12/src/firebase/rating-types.ts` — Added `displayGrade?: TeiGrade`

### Documentation:
- ✅ `docs/TEI-GRADE-SYSTEM.md` — Updated with hysteresis details
- ✅ `docs/HYSTERESIS-IMPLEMENTATION.md` — This document

## Next Steps

### Phase 2.3 - Client Updates:
- [ ] Update `stats-service.ts` to read/write `displayGrade`
- [ ] Update Cloud Functions to calculate `displayGrade` on each rating update
- [ ] Ensure `displayGrade` is included in Firestore writes

### Phase 3 - UI Components:
- [ ] Update `TeiDisplay` component to accept `currentGrade` prop
- [ ] Update all rating displays to pass stored `displayGrade`
- [ ] Test hysteresis behavior in production with real rating updates

## Status

✅ **Hysteresis Fully Implemented**
- 37/37 tests passing
- Engine builds successfully
- Ready for integration into Cloud Functions and UI

