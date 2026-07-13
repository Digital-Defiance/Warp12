# Firebase OpenSkill Schema

**Status:** Draft  
**Author:** Kiro (OpenSkill Migration Phase 2.1)  
**Date:** 2026-07-12

This document specifies the Firestore schema changes required to migrate from Elo-based TEI integers to OpenSkill (μ, σ) tuples.

---

## Overview

### Old Schema (Elo TEI v1)
```typescript
playerStats/{uid}: {
  // Local AI stats (solo vs Ensign/Lieutenant/Commander)
  localAi: {
    ensign/lieutenant/commander: {
      goOut: {
        unassistedTei: 1050,        // Integer
        unassistedMatches: 15,
        unassistedWins: 8
      },
      penalty: { ... }              // "points" renamed to "penalty"
    }
  },
  
  // Human pool stats (online rated sectors)
  humanTei: {
    goOut: {
      unassistedTei: 1450,          // Integer
      unassistedMatches: 23,
      unassistedWins: 14
    },
    points: { ... }
  },
  
  // Charter/crew stats (crew-specific pools)
  groupTei: {
    "{charterId}": {
      seasonKey: "2025-fall",
      goOut: { unassistedTei: 1380, ... },
      points: { ... }
    }
  }
}
```

### New Schema (OpenSkill TEI v2)
```typescript
playerStats/{uid}: {
  // Local AI stats (solo vs Ensign/Lieutenant/Commander)
  localAi: {
    ensign/lieutenant/commander: {
      goOut: {
        rating: {
          mu: 27.5,                  // Skill estimate
          sigma: 6.2,                // Uncertainty
          matches: 15,               // Experience count
          displayRating: 8.9         // Cached μ - 3σ
        },
        wins: 8                      // Simplified (no "unassisted" prefix)
      },
      points: { ... }                // Changed from "penalty"
    }
  },
  
  // Human pool stats (online rated sectors)
  humanTei: {
    goOut: {
      rating: {
        mu: 32.1,
        sigma: 4.1,
        matches: 23,
        displayRating: 19.8
      },
      wins: 14
    },
    points: { ... }
  },
  
  // Charter/crew stats (crew-specific pools)
  groupTei: {
    "{charterId}": {
      seasonKey: "2025-fall",
      goOut: {
        rating: { mu, sigma, matches, displayRating },
        wins: 12
      },
      points: { ... }
    }
  }
}
```

---

## Detailed Schema Changes

### 1. `playerStats/{uid}` Document

**Root fields (unchanged):**
- `uid: string`
- `displayName: string`
- `matchesCompleted: number`
- `matchesWon: number`
- `roundsPlayed: number`
- `roundsWon: number`
- `totalPoints: number`
- `bestRoundTimeMs?: number`
- `lastPlayedAt?: string`
- `updatedAt: string`
- `captainGender?: 'male' | 'female'`
- `humanRatedGameIds?: string[]` — Idempotency tracking
- `groupRatedIds?: string[]` — Crew match idempotency
- `matchHistory?: MatchHistoryEntry[]` — Recent games for profile

**Changed fields:**

#### `startingTei` → `startingRating`
```typescript
// OLD
startingTei?: {
  goOut?: number;      // e.g., 1200
  points?: number;     // e.g., 1300
}

// NEW
startingRating?: {
  goOut?: {
    mu: number;        // e.g., 28.0
    sigma: number;     // e.g., 8.33
  };
  points?: {
    mu: number;
    sigma: number;
  };
}
```

**Rationale:** Allow users to self-seed with a conservative estimate. σ starts at default (8.33), μ can be adjusted if user has prior experience.

#### `localAi` Structure
```typescript
// OLD
localAi?: {
  ensign/lieutenant/commander: {
    matchesCompleted: number;
    matchesWon: number;
    advisorMatches: number;
    advisorWins: number;
    goOut?: {
      unassistedTei?: number;
      unassistedMatches: number;
      unassistedWins: number;
    };
    penalty?: { ... };  // "points" was called "penalty" in old code
  };
}

// NEW
localAi?: {
  ensign/lieutenant/commander: {
    // Overall stats across all modes (assisted + unassisted)
    matchesCompleted: number;
    matchesWon: number;
    advisorMatches: number;
    advisorWins: number;
    
    // Per-objective ratings (unassisted only)
    goOut?: {
      rating: {
        mu: number;
        sigma: number;
        matches: number;        // Replaces unassistedMatches
        displayRating: number;  // Cached μ - 3σ
      };
      wins: number;             // Replaces unassistedWins
    };
    points?: { ... };           // Renamed from "penalty"
  };
}
```

**Key changes:**
- Replace `unassistedTei: number` → `rating: { mu, sigma, matches, displayRating }`
- Rename `penalty` → `points` (consistent with user-facing terminology)
- Cache `displayRating` on write to avoid recomputation on leaderboard reads

#### `humanTei` Structure
```typescript
// OLD
humanTei?: {
  goOut?: {
    unassistedTei?: number;
    unassistedMatches: number;
    unassistedWins: number;
  };
  points?: { ... };
}

// NEW
humanTei?: {
  goOut?: {
    rating: {
      mu: number;
      sigma: number;
      matches: number;
      displayRating: number;
    };
    wins: number;
  };
  points?: { ... };
}
```

#### `groupTei` Structure
```typescript
// OLD
groupTei?: {
  "{charterId}": {
    seasonKey?: string;
    goOut?: {
      unassistedTei?: number;
      unassistedMatches: number;
      unassistedWins: number;
    };
    points?: { ... };
  };
}

// NEW
groupTei?: {
  "{charterId}": {
    seasonKey?: string;
    goOut?: {
      rating: {
        mu: number;
        sigma: number;
        matches: number;
        displayRating: number;
      };
      wins: number;
    };
    points?: { ... };
  };
}
```

#### `matchHistory` Entries
```typescript
interface MatchHistoryEntry {
  playedAt: string;
  objective: 'go-out' | 'points';
  opponentSkill?: 'ensign' | 'lieutenant' | 'commander';
  opponentOmega?: boolean;
  opponentClass1Star?: boolean;
  opponentContext?: 'human' | 'reference';
  playerCount?: number;
  finishRank?: number;
  won: boolean;
  advisorUsed: boolean;
  decisionPct?: number;
  decisionGrade?: string;
  
  // OLD: teiBefore, teiAfter, teiDelta (integers)
  // NEW: rating before/after (μ/σ tuples)
  ratingBefore?: {
    mu: number;
    sigma: number;
    displayRating: number;
  };
  ratingAfter?: {
    mu: number;
    sigma: number;
    displayRating: number;
  };
  muDelta?: number;          // Δμ for trend charts
  sigmaDelta?: number;       // Δσ to show confidence improving
}
```

---

## 2. `ratedMatches/{matchCode}` Document

**Changed fields:**

```typescript
interface RatedMatchDocument {
  // ... (unchanged root fields)
  
  // OLD: certificate contains TEI integers
  // NEW: certificate contains rating tuples
  certificate?: RatedMatchCertificate;
}

interface RatedMatchCertificatePlayer {
  uid: string;
  displayName: string;
  rank: number;
  score: number;
  
  // Crew rating (if charter match)
  crewRatingBefore?: { mu: number; sigma: number; displayRating: number };
  crewRatingAfter?: { mu: number; sigma: number; displayRating: number };
  crewMuDelta?: number;
  
  // Human pool rating (if non-charter match)
  humanRatingBefore?: { mu: number; sigma: number; displayRating: number };
  humanRatingAfter?: { mu: number; sigma: number; displayRating: number };
  humanMuDelta?: number;
}
```

**Note:** Old fields (`crewTeiBefore`, `globalTeiBefore`, `humanTeiBefore`) will be removed. Only keep the OpenSkill versions.

---

## 3. Migration Strategy

### Option A: Clean Wipe (Recommended)
**User confirmed:** "nobody is using this and we can wipe firebase"

**Steps:**
1. Delete all documents in `playerStats` collection
2. Delete all documents in `ratedMatches` collection
3. Deploy new schema with OpenSkill
4. First match for each player starts at DEFAULT_RATING (μ=25, σ=8.33)

**Pros:**
- Simplest implementation
- No data conversion complexity
- Fresh start with calibrated anchors

**Cons:**
- All historical data lost (acceptable per user)

### Option B: Legacy Migration (If Needed Later)
If we ever need to migrate existing Elo ratings:

```typescript
function convertEloToOpenSkill(elo: number, matches: number): PlayerRating {
  // Map Elo to μ (rough conversion)
  // Elo 1000 ≈ μ 25.0 (midpoint)
  // Elo 1400 ≈ μ 32.0 (Commander)
  const mu = 25.0 + (elo - 1000) / 50;
  
  // σ decreases with experience
  const sigma = Math.max(
    2.5,  // Minimum uncertainty (veteran)
    8.33 - (matches / 20)  // Decay: 8.33 → 2.5 over ~100 matches
  );
  
  return { mu, sigma, matches };
}
```

**Not implementing this now** — clean wipe is sufficient.

---

## 4. Firestore Rules Changes

### Current Rules (Elo-based)
```
match /playerStats/{uid} {
  allow read: if true;
  allow write: if request.auth.uid == uid 
    && (!('humanTei' in request.resource.data) || false);  // Block client writes to humanTei
}
```

### New Rules (OpenSkill-based)
```
match /playerStats/{uid} {
  allow read: if true;
  
  allow write: if request.auth.uid == uid
    && validatePlayerStatsUpdate(request.resource.data);
}

function validatePlayerStatsUpdate(data) {
  // Block client writes to rating fields — only Cloud Functions can update
  return !('humanTei' in data)
    && !('groupTei' in data)
    && (!('localAi' in data) || validateLocalAiUpdate(data.localAi));
}

function validateLocalAiUpdate(localAi) {
  // Clients can update match counts, but not ratings
  return !('rating' in localAi.ensign.goOut)
    && !('rating' in localAi.ensign.points)
    && !('rating' in localAi.lieutenant.goOut)
    && !('rating' in localAi.lieutenant.points)
    && !('rating' in localAi.commander.goOut)
    && !('rating' in localAi.commander.points);
}

function validateRating(rating) {
  // Ensure rating structure is valid
  return rating.keys().hasAll(['mu', 'sigma', 'matches', 'displayRating'])
    && rating.mu is number
    && rating.sigma is number
    && rating.matches is int
    && rating.displayRating is number
    && rating.sigma >= 0
    && rating.matches >= 0;
}
```

**Note:** Cloud Functions will have admin access and bypass these rules.

---

## 5. Backward Compatibility

### Reading Old Documents (Deprecated)
If we ever need to read old Elo data (e.g., archives):

```typescript
function readLegacyRating(
  legacyStats: { unassistedTei?: number; unassistedMatches: number }
): PlayerRating | null {
  if (!legacyStats.unassistedTei || legacyStats.unassistedMatches === 0) {
    return null;
  }
  
  // Treat old TEI as μ - 3σ (display rating equivalent)
  // Reverse: μ = displayRating + 3σ
  // Assume σ based on experience
  const sigma = Math.max(2.5, 8.33 - legacyStats.unassistedMatches / 20);
  const mu = legacyStats.unassistedTei / 100 + 3 * sigma;
  
  return {
    mu,
    sigma,
    matches: legacyStats.unassistedMatches,
    displayRating: legacyStats.unassistedTei / 100,
  };
}
```

**Not implementing** — clean wipe makes this unnecessary.

---

## 6. Implementation Checklist

- [ ] Update TypeScript types in `apps/Warp12/src/firebase/stats-schema.ts`
- [ ] Update TypeScript types in `functions/src/tei/rated-match-schema.ts`
- [ ] Replace Elo functions in `apps/Warp12/src/firebase/stats-elo.ts`
- [ ] Replace Elo functions in `functions/src/tei/stats-elo.ts`
- [ ] Update `apply-human-tei.ts` → `apply-human-rating.ts`
- [ ] Update `apply-group-tei.ts` → `apply-group-rating.ts`
- [ ] Update `build-rated-match-certificate.ts` (new rating format)
- [ ] Update Firestore rules (`firestore.rules`)
- [ ] Wipe production Firestore collections
- [ ] Deploy Cloud Functions
- [ ] Deploy Firestore rules
- [ ] Test with Firebase emulator

---

## 7. Data Size Implications

### Old Format (Elo)
```json
{
  "goOut": {
    "unassistedTei": 1450,
    "unassistedMatches": 23,
    "unassistedWins": 14
  }
}
```
**Size:** ~80 bytes

### New Format (OpenSkill)
```json
{
  "goOut": {
    "rating": {
      "mu": 32.1,
      "sigma": 4.1,
      "matches": 23,
      "displayRating": 19.8
    },
    "wins": 14
  }
}
```
**Size:** ~120 bytes

**Impact:** ~50% increase per rating bucket, but still well within Firestore document size limits (1MB). A typical player with 3 AI tiers × 2 objectives = 6 buckets would use ~720 bytes vs ~480 bytes. Negligible.

**Mitigation:** Cache `displayRating` on write to avoid recomputing on every read (leaderboard queries).

---

## 8. Query Implications

### Leaderboard Queries (Most Important)

**Old Query:**
```typescript
db.collection('playerStats')
  .where('humanTei.goOut.unassistedMatches', '>=', 10)
  .orderBy('humanTei.goOut.unassistedTei', 'desc')
  .limit(100);
```

**New Query:**
```typescript
db.collection('playerStats')
  .where('humanTei.goOut.rating.matches', '>=', 10)
  .orderBy('humanTei.goOut.rating.displayRating', 'desc')  // Cached
  .limit(100);
```

**Index Required:**
```json
{
  "collectionGroup": "playerStats",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "humanTei.goOut.rating.matches", "order": "ASCENDING" },
    { "fieldPath": "humanTei.goOut.rating.displayRating", "order": "DESCENDING" }
  ]
}
```

**Note:** Update `firestore.indexes.json` with new composite indexes.

---

## Summary

**Schema Version:** TEI v2 (OpenSkill)  
**Migration Path:** Clean wipe (no legacy conversion)  
**Breaking Changes:** Complete Firestore schema rewrite  
**Data Loss:** All historical ratings (user accepted)  
**Deployment:** Requires coordinated deploy (functions + rules + client)

**Next Steps:**
1. Implement new TypeScript types (Phase 2.1)
2. Replace Elo functions with OpenSkill calls (Phase 2.2)
3. Update Firestore rules (Phase 2.1)
4. Wipe production Firestore (Phase 2.1)
5. Deploy all components (Phase 2.3)

---

**Status:** Ready for implementation ✅
