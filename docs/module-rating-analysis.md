# Module Rating Analysis — Complete Audit

**Date:** 2026-07-12  
**Status:** Ready for Module Zeta Implementation + Rated Play

## Executive Summary

All 11 modules are now implemented or in active development. **Module Zeta (Squadrons)** introduces **team play**, which requires a rating system decision before it can be rated.

## Module Implementation Status


| Module                     | Greek | Engine    | UI  | Calibrated | Classification    | Rating Impact         |
| -------------------------- | ----- | --------- | --- | ---------- | ----------------- | --------------------- |
| Alpha (Continuum)          | Α     | ✅         | ✅   | ✅          | Rated             | None (FFA)            |
| Beta (Salamander)          | Β     | ✅         | ✅   | ✅          | Rated             | None (FFA)            |
| Gamma (Sensor Grid)        | Γ     | ✅         | ✅   | ✅          | Rated             | None (FFA)            |
| Delta (Hot Potato)         | Δ     | ✅         | ✅   | ✅          | Rated             | None (FFA)            |
| **Epsilon (Drafting)**     | Ε     | ✅         | ⚠️  | 🔄 Running | Rated             | None (FFA)            |
| **Zeta (Squadrons)**       | Ζ     | 🔄 In Dev | ❌   | ❌          | **TBD**           | **REQUIRES DECISION** |
| **Eta (Temporal Debt)**    | Η     | ✅         | ⚠️  | ⏸️ Pending | Rated             | None (FFA)            |
| Theta (Longest Trail)      | Θ     | ✅         | ✅   | ✅          | Rated             | None (FFA)            |
| Iota (Double Down)         | Ι     | ✅         | ✅   | ✅          | Rated             | None (FFA)            |
| Kappa (Temporal Inversion) | Κ     | ✅         | ✅   | ✅          | Warped/Exhibition | None (FFA)            |
| Lambda (Wormholes)         | Λ     | ✅         | ✅   | ✅          | Warped/Exhibition | None (FFA)            |


**Legend:**

- ✅ Complete
- ⚠️ Partial (engine done, UI pending)
- 🔄 In development / running
- ❌ Not started
- ⏸️ Ready to run after Epsilon completes



## Module Zeta: Rating System Decision Required



### What Zeta Changes

**Module Zeta transforms the game from FFA to team play:**

- Captains form **squadrons** (2-3 per team)
- Each squadron shares:
  - A single **Warp Trail** (all teammates play on it)
  - A single **Distress Beacon**
  - **Victory condition** (one member empties hand = squad wins)
  - **Scoring** (aggregate remaining pips across all hands)



### Three Rating Approaches



#### Option 1: Exhibition Only (Simplest)

**Implementation:**

- Mark all Zeta games as `rated: false` automatically
- No TEI changes, no leaderboard updates
- Squad play is social/casual only

**Pros:**

- Zero rating system changes
- Keep current Elo implementation unchanged
- No multi-factor complexity

**Cons:**

- No competitive Zeta play
- No skill tracking for squadron captains

**Effort:** Minimal (1-2 hours to wire exhibition flag)

---



#### Option 2: Squad-as-Unit Rating (Elo Compatible)

**Implementation:**

- Create **squad rating pools** separate from FFA
- A squad gets **one TEI**, all members share it
- Squad membership is fixed per charter/session
- Storage: `squadronTei[squadId][track]`

**Example:**

```typescript
// Squad "Apollo" with 3 captains plays 10 games
squadronTei: {
  "apollo": {
    goOut: { tei: 1450, matches: 10 },
    points: { tei: 1520, matches: 8 }
  }
}
```

**Rating logic:**

- Match "Apollo Squad" (entity) vs "Artemis Squad" (entity)
- Standard Elo pairwise update between squads
- Human captains' individual FFA TEI is **unaffected**

**Pros:**

- Uses existing Elo math (pairwise updates work)
- Clean separation: squad TEI ≠ human TEI
- No cross-contamination between FFA and squad ratings
- Simple storage model

**Cons:**

- Doesn't answer "how good is Alice at squad play?"
- Only tells you "how good is this particular squad?"
- Squad roster changes = new squad = new TEI from scratch

**Effort:** Moderate (2-3 days)

- New Firestore schema: `squadronRatings/{squadId}`
- New leaderboard view: squad rankings
- Squad formation UI in lobbies
- Match reporting for squad games

---



#### Option 3: Individual-within-Team Rating (OpenSkill/TrueSkill)

**Implementation:**

- Migrate **entire rating system** to OpenSkill (Bayesian)
- Track **individual captain skill** even in team games
- OpenSkill models: `μ` (skill mean) + `σ` (uncertainty)
- Partial observability: team wins, but who contributed what?

**Math overview:**

```typescript
// Before match
alice: { μ: 25.0, σ: 8.33 }  // Class III-ish
bob:   { μ: 25.0, σ: 8.33 }

// Squad A (alice + bob) beats Squad B
// OpenSkill updates both alice and bob individually
// based on team outcome + opponent ratings

// After match
alice: { μ: 27.3, σ: 7.9 }   // Increased skill
bob:   { μ: 26.8, σ: 7.8 }
```

**Pros:**

- Unified rating: captains rated consistently across FFA + squad modes
- Answers "how good is Alice at Warp?" regardless of game type
- Handles mixed tables (FFA + squads in same dataset)
- Industry standard for team games (Halo, LoL, Overwatch)

**Cons:**

- **Complete rating system rewrite**
  - Replace all Elo update logic (§6 of TEI spec)
  - Rewrite `stats-elo.ts`, `tei-spec.md`, leaderboard, calculator
  - Migrate 171K games of existing data (or hard-reset)
- **Paper becomes outdated** — all Elo calibration results invalidated
- **Interoperability breaks** — third parties expecting Elo TEI won't work
- **Display changes** — show μ±σ ranges instead of single integers?
- **Complexity** — OpenSkill has more parameters to tune (β, τ, etc.)

**Effort:** High (2-3 weeks)

- OpenSkill library integration (openskill.js)
- Rewrite rating update logic everywhere
- Database migration or hard reset
- Update TEI spec, paper, figures
- Retune reference anchors (Ensign-Commander μ values)
- Re-run 171K game study with new rating system

---



## Rating System Decision Matrix


| Criterion                      | Exhibition | Squad-as-Unit (Elo) | Individual (OpenSkill) |
| ------------------------------ | ---------- | ------------------- | ---------------------- |
| **Implementation time**        | 1-2 hours  | 2-3 days            | 2-3 weeks              |
| **Current Elo preserved**      | ✅ Yes      | ✅ Yes               | ❌ No (full rewrite)    |
| **Paper/spec preserved**       | ✅ Yes      | ✅ Yes               | ❌ No (invalidated)     |
| **Squad competitive play**     | ❌ No       | ✅ Yes               | ✅ Yes                  |
| **Individual skill in squads** | N/A        | ❌ No                | ✅ Yes                  |
| **FFA + Squad unified**        | N/A        | ❌ Separate pools    | ✅ One rating           |
| **Breaking change**            | None       | Minor (new tables)  | **Major** (rewrite)    |




## Recommendation



### For Warp 12 v1.4 (Now)

**Choose Option 2: Squad-as-Unit Rating (Elo Compatible)**

**Rationale:**

1. **Preserves your 171K-game calibration study** — FFA Elo stays unchanged
2. **Enables competitive squad play** — squads earn ratings, leaderboards exist
3. **Keeps TEI spec stable** — third-party interoperability maintained
4. **Ships in days, not weeks** — no rating system rewrite
5. **Aligns with your paper** — Elo-based findings remain valid



### Implementation Plan



#### Phase 1: Engine (2 days)

- [ ] Implement squad formation logic
- [ ] Shared trail mechanics (all squad members chart on one trail)
- [ ] Shared beacon (squad shields = up if ANY member plays on squad trail)
- [ ] Squad victory (first member out = squad wins)
- [ ] Squad scoring (sum all remaining hands in squad)



#### Phase 2: Rating System (1 day)

- [ ] New Firestore schema: `squadronRatings/{squadId}/{track}`

```typescript
squadronRatings/{squadId}: {
  goOut: { tei: number, matches: number, wins: number },
  points: { tei: number, matches: number, wins: number },
  roster: PlayerId[],  // Fixed membership
  createdAt: timestamp
}
```

- [ ] Squad match reporting function (`reportSquadMatch`)
- [ ] Pairwise Elo update between squads (reuse existing `updateTeiMultiplayerPairwise`)



#### Phase 3: UI (1 day)

- [ ] Squad formation UI in lobby
- [ ] Squad leaderboard view (`/squadrons`)
- [ ] Squad match history
- [ ] "Rated Squad Match" badge in lobby



#### Phase 4: Calibration (1 day)

- [ ] Run Zeta calibration (38 configs × 500 games = 19K games)
- [ ] Validate skill ordering in squad play
- [ ] Publish results to MODULE-ANALYSIS.md



### Storage Schema

**Individual human captain** (unchanged):

```typescript
playerStats/{uid}: {
  humanTei: {
    goOut: { unassistedTei: 1450, matches: 50 },
    points: { unassistedTei: 1520, matches: 42 }
  },
  localAi: { /* FFA vs AI */ }
}
```

**Squadron rating** (new):

```typescript
squadronRatings/{squadId}: {
  squadName: "Apollo Squadron",
  roster: ["alice-uid", "bob-uid", "carol-uid"],
  formation: "2024-07-12T10:00:00Z",
  
  goOut: {
    tei: 1450,
    matches: 10,
    wins: 6,
    kFactor: 32
  },
  
  points: {
    tei: 1520,
    matches: 8,
    wins: 5,
    kFactor: 32
  }
}
```

**Squad match record**:

```typescript
squadMatches/{matchId}: {
  timestamp: "2024-07-12T14:30:00Z",
  objective: "goOut",
  squads: {
    "apollo": { finalStanding: 1, rosterUids: [...] },
    "artemis": { finalStanding: 2, rosterUids: [...] }
  },
  teiChanges: {
    "apollo": { before: 1450, after: 1468, delta: +18 },
    "artemis": { before: 1420, after: 1408, delta: -12 }
  }
}
```



### Rating Update Logic

**Squad vs Squad (2 squads, heads-up):**

```typescript
// Standard Elo head-to-head
const apolloExpected = expectedEloScore(apolloTei, artemisTei);
const apolloActual = apolloWon ? 1 : 0;
const deltaApollo = K * (apolloActual - apolloExpected);

apolloTei' = apolloTei + deltaApollo;
artemisTei' = artemisTei - deltaApollo;  // Zero-sum
```

**Multi-squad (3+ squads, FFA between squads):**

```typescript
// Reuse existing pairwise multiplayer Elo (§6.5)
// Each squad is treated as one "player"
for (const squadA of squads) {
  let totalDelta = 0;
  for (const squadB of squads) {
    if (squadA === squadB) continue;
    const score = rankScore(squadA, squadB);  // 1, 0.5, or 0
    const expected = expectedEloScore(squadA.tei, squadB.tei);
    totalDelta += (score - expected);
  }
  squadA.tei' = squadA.tei + (K / (n-1)) * totalDelta;
}
```

**Mixed tables (squads + FFA captains)?**

- **Not supported in v1.4** — keep it simple
- Either all FFA or all squads, never mixed in one game
- Lobby enforces: Zeta module = squads only, no individual captains



### Leaderboard Display

**Squad Rankings Page** (`/squadrons`):


| Rank | Squad Name      | Roster              | Points TEI | Matches | Win % |
| ---- | --------------- | ------------------- | ---------- | ------- | ----- |
| 1    | Apollo Squadron | Alice, Bob, Carol   | 1650       | 24      | 67%   |
| 2    | Artemis Squad   | Dave, Eve           | 1580       | 18      | 61%   |
| 3    | Odyssey Crew    | Frank, Grace, Henry | 1520       | 31      | 52%   |


**Individual captain profile** (unchanged):

- Shows FFA TEI (human pool, AI tiers)
- Shows crew charter TEI (existing feature)
- **New section:** "Squadron Membership"
  - Lists squads this captain belongs to
  - Shows each squad's TEI (read-only)
  - Links to squad detail page



### Eligibility Rules for Rated Squad Play

**Extend TEI spec §4 (Rated Match Eligibility):**

**Additional rules for squad matches:**


| Rule                       | Description                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| **Z1 Squad Configuration** | Lobby has Module Zeta enabled; fleet is divided into equal squads (2-3 captains per squad) |
| **Z2 Squad Minimum**       | At least 2 squads in the match (heads-up or multi-squad FFA)                               |
| **Z3 Verified Members**    | All human captains in all squads are signed in (no guests)                                 |
| **Z4 Roster Locked**       | Squad rosters are frozen at match start (no mid-game substitutions)                        |
| **Z5 Same Objective**      | Uses existing objective rules (§4 E1: Points or Go-out)                                    |
| **Z6 Standard Rules**      | Same profile ID as non-Zeta rated play (§4 E4)                                             |
| **Z7 No Advisor**          | No captain used tactical advisor (§4 E3)                                                   |
| **Z8 Rating Pool**         | Updates `squadronRatings` only; individual human TEI unaffected                            |


**Ineligible:** Mixed FFA+squad tables, guests in squads, mid-match roster changes.

### TEI Spec Updates

**Add new section §11: Squadron Rating (Module Zeta)**

```markdown
## §11. Squadron Rating (Module Zeta Team Play)

When Module Zeta is enabled, captains form **squadrons** (teams of 2-3).
Each squadron shares one trail, one beacon, and one victory condition.

### 11.1 Squad Rating Storage

Squads are rated as **units**. Each squad has its own TEI per track,
independent of members' individual FFA ratings.

Storage: `squadronRatings/{squadId}/{track}`

```typescript
{
  tei: number,        // Squad TEI
  matches: number,    // Squad matches played
  wins: number,       // Squad victories
  kFactor: number     // K-schedule (40 → 32 → 24)
}
```

### 11.2 Squad Rating Updates

Squads use the same Elo update logic as FFA:

- **Heads-up (2 squads):** Standard Elo (§6.3)
- **Multi-squad (3+):** Pairwise Elo (§6.5)

A squad with `N = 0` prior matches starts at TEI 1000.

### 11.3 Cross-Pool Independence

- **Squad TEI** updates only `squadronRatings/{squadId}`
- **Individual FFA TEI** in `humanTei` is **unaffected**
- **Crew charter TEI** in `groupTei` is **unaffected**

Playing squad matches does not change your personal FFA rating.

### 11.4 Roster Locking

Squad rosters are **immutable per squad entity**:

- Roster defined at squad creation
- Changing members creates a **new squad** with new TEI
- No TEI transfer between old/new squad

### 11.5 Squad Leaderboards

Squads appear on separate leaderboards by track:

- `/squadrons/go-out` — Go-out squad rankings
- `/squadrons/points` — Points squad rankings

Individual captain profiles link to squads they belong to.

```

---
```



## Alternative: Future v2.0 with OpenSkill

**If you later want unified FFA+squad ratings:**

You could ship v1.4 with **Option 2** (squad-as-unit) now, then in v2.0:

- Migrate to OpenSkill for **new ratings only**
- Keep v1.4 Elo ratings as "legacy TEI" (frozen, display-only)
- Offer captains a one-time "reset to OpenSkill" option
- Mark it as a major version bump with migration guide

This gives you:

- **v1.4:** Ships quickly, preserves research, enables squad play
- **v2.0:** Unified rating later if user demand justifies the effort

---



## Summary



### Decision Point: How to Rate Module Zeta?

**Recommended: Squad-as-Unit (Elo Compatible)**

- ✅ Ships in ~5 days (engine + rating + UI + calibration)
- ✅ Preserves 171K-game study and TEI paper
- ✅ Enables competitive squad play with leaderboards
- ✅ Clean separation: squad TEI ≠ human TEI
- ✅ No rating system rewrite

**Not Recommended: OpenSkill Migration**

- ❌ 2-3 week rewrite
- ❌ Invalidates research
- ❌ Breaking change for all users
- ❌ Overkill for one module

**Next Steps:**

1. ✅ Finish Epsilon calibration (running now)
2. Implement Module Zeta engine (2 days)
3. Implement squad rating system (1 day)
4. Build squad UI (1 day)
5. Run Zeta calibration (19K games, 1 day)
6. ✅ Run Eta calibration after Epsilon (19K games, 1 day)
7. Update paper with complete 12-module analysis

**Total timeline: ~1 week to rated squad play**

---

**Ready to proceed with Option 2?** I can help implement the squad rating schema and update the TEI spec.