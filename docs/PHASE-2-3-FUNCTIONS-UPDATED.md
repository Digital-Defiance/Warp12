# Phase 2.3: Cloud Functions Updated with TEI Grades & Hysteresis

## Summary

Updated all Cloud Functions to calculate and store `displayGrade` with hysteresis support.

## Changes Made

### 1. Rating Types (`functions/src/tei/rating-types.ts`)

**Added `displayGrade` field:**
```typescript
export interface StoredRating {
  readonly mu: number;
  readonly sigma: number;
  readonly matches: number;
  readonly displayRating: number;        // μ - 3σ
  readonly displayGrade?: TeiGrade;      // NEW: E/V/C/I/P with hysteresis
}
```

**Added helper function:**
```typescript
export function toStoredRatingWithGrade(
  rating: { mu: number; sigma: number; matches: number },
  previousRating?: StoredRating
): StoredRating
```

This function:
- Imports `getTeiDisplay` from `warp12-engine`
- Reads `previousRating.displayGrade` for hysteresis
- Calculates new TEI grade with hysteresis
- Returns `StoredRating` with new `displayGrade`

### 2. Human Rating Updates (`apply-human-tei.ts`)

**Changed:**
```typescript
// Before
const ratingAfter = toStoredRating({
  ...newRating,
  matches: ratingBefore.matches + 1,
});

// After
const ratingAfter = toStoredRatingWithGrade(
  {
    ...newRating,
    matches: ratingBefore.matches + 1,
  },
  ratingBefore // Pass previous rating for hysteresis
);
```

**Effect:** Online human vs human matches now calculate and store TEI grades

### 3. Group/Charter Rating Updates (`apply-group-tei.ts`)

Same change as #2 - group/crew ratings now include `displayGrade`

### 4. Solo AI Practice (`report-practice-ai.ts`)

Same change as #2 - solo practice vs AI now includes `displayGrade`

### 5. Exports Updated

- `rating-types.ts`: Exports `toStoredRatingWithGrade`
- `rated-match-schema.ts`: Exports `toStoredRatingWithGrade`
- `tei/index.ts`: Exports `toStoredRatingWithGrade`

## How Hysteresis Works

1. **First Match** (new player):
   - `previousRating` is `undefined` or has no `displayGrade`
   - `getTeiDisplay(newRating, undefined)` uses raw thresholds
   - Result stored with `displayGrade` (e.g., "V")

2. **Subsequent Matches**:
   - Read `previousRating.displayGrade` from Firestore
   - `getTeiDisplay(newRating, previousRating.displayGrade)` applies hysteresis
   - Different enter/exit thresholds prevent flickering
   - New `displayGrade` saved to Firestore

3. **Example Flow**:
   ```typescript
   // Match 1: Player σ = 1.5 (new)
   getTeiDisplay({ mu: 28, sigma: 1.5, matches: 1 }, undefined)
   // → grade: 'C' (raw threshold: 1.5 ≤ σ < 2.5)
   // Saved: displayGrade = 'C'
   
   // Match 2: Player σ = 1.42 (improving)
   getTeiDisplay({ mu: 29, sigma: 1.42, matches: 2 }, 'C')
   // → grade: 'C' (hysteresis: stays C until σ < 1.4)
   // Saved: displayGrade = 'C'
   
   // Match 3: Player σ = 1.35 (crossed threshold)
   getTeiDisplay({ mu: 30, sigma: 1.35, matches: 3 }, 'C')
   // → grade: 'V' (crossed V enter threshold at 1.4)
   // Saved: displayGrade = 'V' ← PROMOTION!
   ```

## Database Schema

### Firestore `playerStats/{uid}`:

```typescript
{
  uid: "abc123",
  displayName: "Alice",
  humanRating: {
    goOut: {
      rating: {
        mu: 32.0,
        sigma: 1.2,
        matches: 150,
        displayRating: 28.4,      // μ - 3σ
        displayGrade: "V"          // NEW: Hysteresis-stable grade
      },
      wins: 87
    },
    points: {
      rating: {
        mu: 28.5,
        sigma: 2.1,
        matches: 120,
        displayRating: 22.2,
        displayGrade: "C"          // NEW
      },
      wins: 65
    }
  },
  localAi: {
    commander: {
      goOut: {
        rating: {
          mu: 30.0,
          sigma: 2.8,
          matches: 45,
          displayRating: 21.6,
          displayGrade: "I"        // NEW
        },
        wins: 22
      }
    }
  }
}
```

## Build Status

✅ **Functions build successfully**
- All TypeScript compiles without errors
- Vendor packages staged correctly
- Ready for deployment

## Files Modified

### Core Functions:
- ✅ `functions/src/tei/rating-types.ts` - Added `displayGrade`, `toStoredRatingWithGrade()`
- ✅ `functions/src/tei/apply-human-tei.ts` - Uses `toStoredRatingWithGrade()`
- ✅ `functions/src/tei/apply-group-tei.ts` - Uses `toStoredRatingWithGrade()`
- ✅ `functions/src/report-practice-ai.ts` - Uses `toStoredRatingWithGrade()`

### Exports:
- ✅ `functions/src/tei/rated-match-schema.ts` - Exports new function
- ✅ `functions/src/tei/index.ts` - Exports new function

## Testing Checklist

Before deployment, test:

1. **New player first match:**
   - [ ] Verify `displayGrade` is set (should be P, I, or C depending on starting σ)
   - [ ] Verify grade uses raw thresholds (no hysteresis)

2. **Existing player matches:**
   - [ ] Verify `displayGrade` updates with hysteresis
   - [ ] Verify grade doesn't flicker at boundaries (σ ≈ 1.5, 2.5, 4.0)

3. **Grade promotions:**
   - [ ] Player at C with σ dropping from 2.4 → 1.35 should upgrade to V
   - [ ] Verify old grade was used in calculation

4. **All match types:**
   - [ ] Online human vs human (via `apply-human-tei`)
   - [ ] Group/charter matches (via `apply-group-tei`)
   - [ ] Solo practice vs AI (via `report-practice-ai`)

## Deployment

```bash
# Build functions
cd functions && npm run build

# Deploy to Firebase
cd .. && yarn deploy:functions

# Or deploy everything
yarn deploy:firebase
```

## Integration with UI

The UI components created in Phase 3 expect `displayGrade` to be present:

```tsx
<TeiDisplay 
  rating={playerStats.humanRating.goOut.rating}
  currentGrade={playerStats.humanRating.goOut.rating.displayGrade}  // ← Required
  objective="goOut"
/>
```

Without `displayGrade`, the components will use raw thresholds (which is fine for first display, but won't have hysteresis).

## Next Steps

- [ ] **Deploy functions** to staging/production
- [ ] **Wipe Firestore collections** (user confirmed safe - no production data)
- [ ] **Test end-to-end** rating updates
- [ ] **Phase 3 Integration:** Connect UI components to backend data
- [ ] **Update stats service** to read `displayGrade` from Firestore
- [ ] **Update profile/leaderboard pages** to use new components

---

**Status:** ✅ Phase 2.3 Complete - Functions ready for deployment  
**Build:** ✅ All functions compile successfully  
**Hysteresis:** ✅ Fully integrated into rating calculations  
**Ready for:** Phase 3 UI integration + deployment

