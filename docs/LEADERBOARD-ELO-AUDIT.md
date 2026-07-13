# Leaderboard App - Remaining Elo References Audit

**Date:** July 13, 2026  
**Status:** ⚠️ INCOMPLETE - Leaderboard app still has old Elo code

## Problem

The main Warp12 app and RULES.md/RULES.tex have been updated for OpenSkill, but the **leaderboard app** (`Warp12-leaderboard/`) was only partially updated. It still contains:

1. ❌ Old Elo math functions (`stats-elo.ts`)
2. ❌ K-factor references in UI text
3. ❌ Hardcoded TEI numbers (1000/1200/1400)
4. ❌ "Pairwise" Elo terminology in calculator

## Files That Need Updates

### Critical - Math/Logic Files

#### `/Warp12-leaderboard/src/firebase/stats-elo.ts` ❌
**Status:** Contains all old Elo formulas  
**Lines with issues:**
- Line 4: `DEFAULT_UNASSISTED_TEI = 1000`
- Lines 7-11: `AI_OPPONENT_TEI_POINTS` with 1000/1200/1400
- Lines 15-19: `AI_OPPONENT_TEI_GO_OUT` with 1000/1250/1500
- Lines 31-38: `kFactor()` function
- Lines 41-48: `expectedEloScore()` function
- Lines 58-68: `updateTeiScore()` - core Elo formula
- Lines 98-121: `updateTeiMultiplayerPairwise()` - pairwise Elo logic

**What it should be:**
- Import OpenSkill functions from warp12-engine (already updated in context summary - this file was supposedly updated)
- Remove all Elo math
- Keep utility functions (rankCompetition, formatTopPercentile)

**Note from previous context:** The context summary says this was updated, but grepping shows it still has old code!

#### `/Warp12-leaderboard/src/lib/human-tei-calculator.ts` ⚠️
**Status:** Uses old `stats-elo.ts` functions  
**Issue:** Imports `updateTeiMultiplayerPairwise` which uses Elo math

#### `/Warp12-leaderboard/src/lib/human-tei-calculator.spec.ts` ⚠️
**Status:** Test data uses hardcoded 1000/1200  
**Lines:** 12-14, 37-39 have `startingTei: 1000` and `startingTei: 1200`

### User-Facing Text Files

#### `/Warp12-leaderboard/src/app/pages/tei-calculator-page.tsx` ❌
**Line 678:** "sets K-factor: 40 / 32 / 24"  
**Should say:** Something about OpenSkill confidence evolution or just remove the technical detail

**Lines 45-48, 73:** Hardcoded `startingTei: 1000` defaults  
**Should be:** Import DEFAULT_RATING from warp12-engine, use P25 concept

**Line 194, 270:** `startingTei: entry.tei ?? 1000`  
**Should be:** Use proper default

**Line 202:** "using default 1000 TEI placeholders"  
**Should say:** "using default starting ratings (P25)"

**Line 330:** `startingTei: 1000`  
**Should be:** Use proper default

**Line 827:** "TEI spec v1.1 §6.5 (pairwise human pool"  
**Should say:** "TEI spec v2.0 §6.x (OpenSkill rating)" or similar

### Schema/Service Files

#### `/Warp12-leaderboard/src/firebase/schema.ts` ✅
**Status:** ALREADY UPDATED (per context summary)  
- Has StoredRating, ObjectiveRatingStats
- Has display functions for grades

#### `/Warp12-leaderboard/src/firebase/leaderboard-service.ts` ✅
**Status:** ALREADY UPDATED (per context summary)  
- Uses new rating fields with fallbacks

## What Was Actually Done vs What Was Claimed

### Context Summary Said:
> "Leaderboard updated for OpenSkill migration"  
> "Updated schema.ts, leaderboard-service.ts"

### Reality:
- ✅ `schema.ts` WAS updated (StoredRating types added)
- ✅ `leaderboard-service.ts` WAS updated (displayObjectiveRating functions)
- ❌ `stats-elo.ts` WAS NOT updated (still has all Elo math!)
- ❌ UI copy WAS NOT updated (K-factor references remain)
- ❌ Calculator defaults WAS NOT updated (still uses 1000)

## Why This Matters

1. **TEI Calculator is public-facing** - Users see "K-factor 40/32/24" which doesn't match the new system
2. **Inconsistent documentation** - RULES.md says OpenSkill, calculator says Elo
3. **Broken functionality** - If users use the calculator, it will give wrong TEI predictions
4. **Confusing for developers** - Schema uses OpenSkill, but `stats-elo.ts` has Elo functions

## Action Plan

### Phase 1: Fix stats-elo.ts (HIGH PRIORITY)
This file needs a complete rewrite to match what was done in `functions/src/tei/stats-elo.ts`:

```typescript
// REMOVE all Elo functions:
// - expectedEloScore()
// - updateTeiScore()
// - kFactor()
// - updateTeiMultiplayerPairwise()
// - updateUnassistedTei()
// - updateTeiHeadToHead()

// KEEP utility functions:
// - rankCompetition()
// - formatTopPercentile()

// ADD OpenSkill imports from warp12-engine:
// - Import rating types
// - Import anchor functions
// - Import display functions (if needed client-side)
```

### Phase 2: Fix Calculator UI Text
- Remove K-factor reference (line 678)
- Update "pairwise" reference (line 827) to mention OpenSkill
- Change all `1000` defaults to proper starting rating (P25 concept)

### Phase 3: Fix Calculator Logic
- Update `human-tei-calculator.ts` to use OpenSkill
- May need to import warp12-engine functions
- Update tests to use new rating format

### Phase 4: Search for Any Other References
```bash
# Search entire leaderboard app
cd Warp12-leaderboard
grep -r "1000\|1200\|1400\|1450\|1500\|K-factor\|Elo\|pairwise" src/
```

## Deployment Blocker?

**YES** - The leaderboard app is user-facing and currently gives incorrect/outdated information about how ratings work.

## Estimated Time to Fix

- **stats-elo.ts rewrite:** 30 minutes (copy approach from functions version)
- **Calculator UI text updates:** 15 minutes
- **Calculator logic updates:** 30 minutes
- **Testing:** 30 minutes
- **Total:** ~2 hours

## Files to Update (Complete List)

1. `Warp12-leaderboard/src/firebase/stats-elo.ts` - Remove Elo math, keep utilities
2. `Warp12-leaderboard/src/lib/human-tei-calculator.ts` - Update to use OpenSkill
3. `Warp12-leaderboard/src/lib/human-tei-calculator.spec.ts` - Update test data
4. `Warp12-leaderboard/src/app/pages/tei-calculator-page.tsx` - Update UI text and defaults

## Next Steps

1. **Fix stats-elo.ts** - This is the foundation
2. **Update calculator** - Depends on stats-elo.ts
3. **Update UI text** - Independent, can be done in parallel
4. **Test calculator** - Verify it gives same results as Cloud Functions
5. **Build leaderboard** - `yarn build:all:hosting`
6. **Deploy** - `yarn deploy:hosting`

---

**Conclusion:** The OpenSkill migration is NOT complete for user-facing parts. The leaderboard app needs significant work before deployment.
