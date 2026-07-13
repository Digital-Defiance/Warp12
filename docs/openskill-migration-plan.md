# OpenSkill Migration Plan
**Date:** 2026-07-12  
**Decision:** Migrate from Elo to OpenSkill before public launch  
**Rationale:** No users yet, can wipe Firebase, future-proof for Module Zeta team play

---

## Why OpenSkill Now?

### The Window of Opportunity

**You have a unique advantage:**
- ✅ No production users to migrate
- ✅ Can wipe Firebase without impact
- ✅ Pre-launch — perfect time for breaking changes
- ✅ Research is for publication, not live production promises

**If you ship with Elo first:**
- ❌ Breaking change post-launch hurts users
- ❌ Database migration complexity
- ❌ Legacy compatibility burden
- ❌ Two rating systems to maintain

### OpenSkill Advantages Over Elo

| Feature | Elo | OpenSkill |
|---------|-----|-----------|
| **FFA multiplayer** | Pairwise approximation | Native support |
| **Team games** | Requires workaround | Native support |
| **Mixed FFA + teams** | Separate pools | Unified rating |
| **Uncertainty modeling** | No | Yes (μ ± σ) |
| **New player variance** | K-factor only | Confidence intervals |
| **Convergence speed** | Slower | Faster (Bayesian updates) |
| **Industry standard** | Chess, 1v1 games | Halo, LoL, Team games |

### The Research Question

**Does this invalidate your 171K-game study?**

**No — it reframes it:**

Your study measured:
- ✅ Module skill ordering (Commander wins X% of games)
- ✅ Configuration complexity (legal moves, entropy, etc.)
- ✅ Luck vs skill indicators
- ✅ Warp factor analysis

**None of that changes with OpenSkill.** You measured **game properties**, not rating convergence.

What DOES change:
- Rating update math (§6 of TEI spec)
- Display values (μ instead of single integer)
- Reference anchors (μ values instead of fixed TEI)

**Paper revision:** ~2-3 days to update §5-6 with OpenSkill math, not a complete rewrite.

---

## OpenSkill 101: Quick Overview

### Core Concept

Instead of a single rating number, each player has:
- **μ (mu):** Skill estimate (mean)
- **σ (sigma):** Uncertainty (standard deviation)

**Display rating:** `μ - 3σ` (conservative estimate, 99.7% confidence)

**Example progression:**
```
New player:    μ=25.0, σ=8.33  →  Display: 0.01
After 10 games: μ=27.5, σ=6.2   →  Display: 8.9
After 50 games: μ=32.1, σ=4.1   →  Display: 19.8
Veteran:        μ=35.0, σ=2.5   →  Display: 27.5
```

### OpenSkill vs TrueSkill

| System | License | Language | Use Case |
|--------|---------|----------|----------|
| **TrueSkill** | Microsoft patent | .NET, Python | Requires license |
| **TrueSkill2** | Microsoft patent | .NET | Requires license |
| **OpenSkill** | MIT | **JavaScript/TS** | ✅ **Use this** |
| **Weng-Lin** | Open | Python | Academic |

**OpenSkill** is the MIT-licensed, JavaScript-native implementation. Perfect for Warp.

---

## Implementation Plan

### Phase 1: Library Integration (1 day)

**Install OpenSkill:**
```bash
yarn add openskill
```

**Create rating adapter:**
```typescript
// libs/engine/src/lib/rating/openskill-adapter.ts

import { rating, rate, ordinal } from 'openskill';

export interface PlayerRating {
  mu: number;      // Skill estimate
  sigma: number;   // Uncertainty
  matches: number; // Experience count
}

export const DEFAULT_RATING: PlayerRating = {
  mu: 25.0,
  sigma: 25.0 / 3,  // σ = 8.33
  matches: 0
};

// Conservative display rating (μ - 3σ)
export function displayRating(r: PlayerRating): number {
  return Math.max(0, r.mu - 3 * r.sigma);
}

// Ordinal rating (for matchmaking)
export function ordinalRating(r: PlayerRating): number {
  return ordinal(rating(r.mu, r.sigma));
}
```

### Phase 2: Replace Rating Update Logic (2 days)

**Current Elo update (§6.3-6.5):**
```typescript
// stats-elo.ts — DELETE THIS
function updateTeiScore(playerTei: number, opponentTei: number, 
                        score: number, k: number): number {
  const expected = expectedEloScore(playerTei, opponentTei);
  return Math.round(playerTei + k * (score - expected));
}
```

**New OpenSkill update:**
```typescript
// libs/engine/src/lib/rating/openskill-updates.ts

import { rating, rate } from 'openskill';

export function updateRatings(
  players: Array<{
    id: PlayerId;
    rating: PlayerRating;
    rank: number;  // 1 = winner, 2 = second, etc.
  }>
): Map<PlayerId, PlayerRating> {
  // Convert to OpenSkill format
  const teams = players.map(p => [rating(p.rating.mu, p.rating.sigma)]);
  const ranks = players.map(p => p.rank);
  
  // Update all ratings in one call
  const updated = rate(teams, { rank: ranks });
  
  // Convert back to our format
  const results = new Map<PlayerId, PlayerRating>();
  players.forEach((p, i) => {
    const [newRating] = updated[i];
    results.set(p.id, {
      mu: newRating.mu,
      sigma: newRating.sigma,
      matches: p.rating.matches + 1
    });
  });
  
  return results;
}

// Team game update (Module Zeta)
export function updateTeamRatings(
  teams: Array<{
    id: string;  // squadId
    members: Array<{ id: PlayerId; rating: PlayerRating }>;
    rank: number;
  }>
): Map<PlayerId, PlayerRating> {
  // Convert to OpenSkill format (team = array of players)
  const openskillTeams = teams.map(team =>
    team.members.map(m => rating(m.rating.mu, m.rating.sigma))
  );
  const ranks = teams.map(t => t.rank);
  
  // Update all ratings
  const updated = rate(openskillTeams, { rank: ranks });
  
  // Convert back
  const results = new Map<PlayerId, PlayerRating>();
  teams.forEach((team, i) => {
    team.members.forEach((member, j) => {
      const newRating = updated[i][j];
      results.set(member.id, {
        mu: newRating.mu,
        sigma: newRating.sigma,
        matches: member.rating.matches + 1
      });
    });
  });
  
  return results;
}
```

**Key difference:** OpenSkill handles FFA and teams with the **same function** (`rate`). No separate pairwise logic needed!

### Phase 3: Update Firestore Schema (1 day)

**Old Elo schema:**
```typescript
playerStats/{uid}: {
  humanTei: {
    goOut: { unassistedTei: 1450, matches: 50 },
    points: { unassistedTei: 1520, matches: 42 }
  }
}
```

**New OpenSkill schema:**
```typescript
playerStats/{uid}: {
  rating: {
    goOut: { 
      mu: 32.5, 
      sigma: 4.2, 
      matches: 50,
      displayRating: 19.9  // Cached μ - 3σ
    },
    points: { 
      mu: 35.1, 
      sigma: 3.8, 
      matches: 42,
      displayRating: 23.7
    }
  },
  
  // Keep separate AI tier tracking for solo play
  localAi: {
    ensign: {
      goOut: { mu: 28.0, sigma: 5.0, matches: 20 },
      points: { mu: 27.5, sigma: 5.5, matches: 18 }
    },
    lieutenant: { /* ... */ },
    commander: { /* ... */ }
  }
}
```

**Migration:** None needed (wiping Firebase)

### Phase 4: Update Reference Anchors (1 day)

**Old Elo anchors (fixed integers):**
```typescript
const REF_TEI = {
  points: {
    ensign: 1000,
    lieutenant: 1200,
    commander: 1400
  }
};
```

**New OpenSkill anchors:**
```typescript
const REF_RATING = {
  points: {
    ensign: { 
      mu: 20.0,   // Below default
      sigma: 4.0, // Experienced AI
      displayRating: 8.0
    },
    lieutenant: { 
      mu: 25.0,   // Default starting point
      sigma: 3.5,
      displayRating: 14.5
    },
    commander: { 
      mu: 32.0,   // Above average
      sigma: 3.0,
      displayRating: 23.0
    }
  },
  // ... goOut similar
};
```

**Calibration:** Run a small study (1K games) to find μ values where:
- New player (μ=25, σ=8.33) wins ~50% vs Commander (μ=32, σ=3.0)
- This replaces the Elo 1400 anchor

### Phase 5: Update Display & UI (2 days)

**Leaderboard display:**
```typescript
// OLD: Simple integer
<div>TEI: {player.humanTei.points.unassistedTei}</div>

// NEW: Display rating with confidence
<div>
  Rating: {player.rating.points.displayRating.toFixed(1)}
  <Tooltip>
    Skill: {player.rating.points.mu.toFixed(1)} 
    ± {(3 * player.rating.points.sigma).toFixed(1)}
  </Tooltip>
</div>
```

**Profile page:**
```tsx
<RatingCard>
  <h3>Points Campaign</h3>
  <div className="display-rating">
    {displayRating.toFixed(1)}
  </div>
  <div className="confidence">
    ±{(3 * rating.sigma).toFixed(1)} confidence
  </div>
  <div className="matches">
    {rating.matches} rated matches
  </div>
</RatingCard>
```

**Provisional badge:**
```typescript
// Show uncertainty when σ is high
const isProvisional = rating.sigma > 6.0;
```

### Phase 6: Update TEI Spec (2 days)

**Major sections to rewrite:**

**§2 Terminology:**
- Replace "K-factor" with "uncertainty decay"
- Add μ, σ, display rating definitions

**§6 Core Update Mathematics:**
- **DELETE:** §6.1-6.5 (all Elo update logic)
- **ADD:** §6.1 OpenSkill rating model
- **ADD:** §6.2 FFA update (single `rate()` call)
- **ADD:** §6.3 Team update (same `rate()` call with teams)

**§7 Constants:**
- Replace fixed TEI integers with μ/σ tuples
- Update reference bands to OpenSkill scale

**Example new §6.1:**
```markdown
## §6.1 OpenSkill Rating Model

Each captain has a skill rating represented by two values:
- **μ (mu):** Skill estimate (Gaussian mean)
- **σ (sigma):** Uncertainty (Gaussian std dev)

Display rating: `r = μ - 3σ` (conservative, 99.7% confidence)

Default new player: μ = 25.0, σ = 8.33, r = 0.01

After each match, OpenSkill updates both μ and σ based on:
- Actual rank/outcome
- Opponent ratings
- Bayesian inference

Implementation: openskill.js `rate()` function.
```

### Phase 7: Update Paper (3 days)

**Sections requiring revision:**

**§5 TEI (Tactical Effectiveness Index):**
- Replace Elo explanation with OpenSkill
- Update reference bands diagram (Figure 6)
- Show μ±σ ranges instead of fixed integers

**§6 Results: AI Calibration:**
- Results stay the same (win rates)
- But replace "implied ΔTEI" with "implied Δμ"
- Calibration matrices unchanged (still show win %)

**§8 Luck vs Skill:**
- No changes (measured game complexity, not rating math)

**Figure updates:**
- Figure 6 (TEI ladder) — show μ±σ ranges
- Figure 10 (points vs go-out) — update axis labels

**New content to add:**
```latex
\subsection{OpenSkill Rating Model}

Warp uses the OpenSkill rating system~\cite{openskill2021}, 
a Bayesian skill estimator that models each captain's ability 
as a Gaussian distribution $\mathcal{N}(\mu, \sigma^2)$.

\textbf{Display rating:} $r = \mu - 3\sigma$ (conservative estimate)

\textbf{Update rule:} After a match with ranks $\vec{r}$ and 
current ratings $\{(\mu_i, \sigma_i)\}$, OpenSkill computes 
posterior distributions via message-passing on a factor graph...
```

---

## Reference AI Calibration with OpenSkill

### Goal
Find μ values where Ensign/Lieutenant/Commander AI have appropriate skill separation.

### Method

**1. Start with default anchors:**
```typescript
const initialAnchors = {
  ensign: { mu: 20.0, sigma: 4.0 },      // Weak
  lieutenant: { mu: 25.0, sigma: 3.5 },  // Default
  commander: { mu: 30.0, sigma: 3.0 }    // Strong
};
```

**2. Run calibration games:**
- 200 games: Ensign vs Lieutenant (both objectives)
- 200 games: Ensign vs Commander
- 200 games: Lieutenant vs Commander
- Measure win rates

**3. Adjust anchors until:**
- Lieutenant wins ~76% vs Ensign (≈200 Elo gap)
- Commander wins ~76% vs Lieutenant
- Commander wins ~91% vs Ensign (≈400 Elo gap)

**4. Publish final anchors** in rating constants.

**Expected result:**
```typescript
const CALIBRATED_ANCHORS = {
  points: {
    ensign: { mu: 18.5, sigma: 4.0 },
    lieutenant: { mu: 25.0, sigma: 3.5 },
    commander: { mu: 32.5, sigma: 3.0 }
  },
  goOut: {
    ensign: { mu: 18.0, sigma: 4.5 },
    lieutenant: { mu: 26.0, sigma: 4.0 },
    commander: { mu: 34.0, sigma: 3.5 }
  }
};
```

**This replaces your Elo REF_TEI constants.**

---

## Timeline & Effort

| Phase | Effort | Dependencies |
|-------|--------|--------------|
| **1. Library integration** | 1 day | None |
| **2. Rating update logic** | 2 days | Phase 1 |
| **3. Firestore schema** | 1 day | Phase 2 |
| **4. Reference anchors** | 1 day | Phase 1-2 |
| **5. UI updates** | 2 days | Phase 3 |
| **6. TEI spec rewrite** | 2 days | Phase 1-4 |
| **7. Paper updates** | 3 days | Phase 1-6 |
| **TOTAL** | **12 days** | Sequential |

**With parallelization:** ~8-10 days (UI and spec can overlap)

---

## What Stays the Same

✅ **Your 171K-game study:**
- Module skill ordering (win rates)
- Configuration complexity metrics
- Luck vs skill indicators
- Warp factor analysis

✅ **Game engine:**
- All module implementations
- AI heuristics
- Self-play infrastructure

✅ **Match eligibility:**
- Unassisted requirement
- Warp 12 rated, others exhibition
- Two-track system (points/go-out)

---

## What Changes

🔄 **Rating math:**
- Elo → OpenSkill
- Single integer → (μ, σ) tuple
- K-factor → Bayesian uncertainty decay

🔄 **Display:**
- "TEI 1450" → "Rating 23.5"
- Show confidence intervals for provisional players

🔄 **Calibration:**
- Find μ anchors instead of fixed TEI integers
- Run 1K-game study to validate (smaller than 171K)

🔄 **Paper sections 5-6:**
- Update rating system description
- Update Figure 6 (ladder diagram)
- Update terminology (ΔTEI → Δμ)

---

## Benefits Over Elo

### 1. Native Team Support (Module Zeta)

**Elo (Option 2):** Separate squad ratings, manual bookkeeping
```typescript
// Squad "Apollo" has its own TEI, separate from members
squadronRatings/apollo: { tei: 1450 }
```

**OpenSkill (Option 3):** Individual ratings automatically updated through team play
```typescript
// Alice and Bob form squad, both get individual updates
updateTeamRatings([
  { members: [alice, bob], rank: 1 },    // Squad A wins
  { members: [carol, dave], rank: 2 }     // Squad B loses
]);
// alice.mu and bob.mu both increase
// carol.mu and dave.mu both decrease
```

**Advantage:** One rating per captain works for FFA AND teams.

### 2. Faster Convergence

**Elo:** K=40 for first 10 games, gradually decreases
- Takes ~30-50 games to reach stable rating
- New players swing wildly

**OpenSkill:** σ decreases naturally with Bayesian updates
- Stable after ~20-30 games
- Confidence intervals prevent extreme swings

### 3. Better Matchmaking (Future)

**Elo:** Match players with similar integers
- Can't distinguish "new 1400" from "veteran 1400"

**OpenSkill:** Match on ordinal rating (μ - σ)
- "New 1400" has high σ → matched conservatively
- "Veteran 1400" has low σ → matched precisely

### 4. Industry Standard

**Halo, League of Legends, Overwatch, Rainbow Six:** All use TrueSkill/OpenSkill variants for team games.

Your users who play these games will recognize the rating system.

---

## Risks & Mitigation

### Risk 1: Paper Revision Delays Publication

**Mitigation:**
- Sections 1-4, 7-8 unchanged (game description, results)
- Only §5-6 need rewrites (~15 pages)
- OpenSkill is well-documented, cite existing literature
- **Timeline:** 3 days for paper updates

### Risk 2: OpenSkill Math Complexity

**Mitigation:**
- Library handles all math (openskill.js)
- You just call `rate(teams, { rank })`
- Simpler than your current Elo pairwise loops
- **Code reduction:** §6.5 multiplayer Elo is ~50 lines → OpenSkill is ~5 lines

### Risk 3: Lost Research "Investment"

**Reality check:**
- You measured **game properties** (complexity, skill ordering)
- Those don't change with rating system
- The "investment" is in game calibration, not Elo math
- **Actual rework:** ~10% of paper (rating sections only)

### Risk 4: User Confusion (μ vs TEI)

**Mitigation:**
- Call it "Skill Rating" or keep "TEI" name
- Display `μ - 3σ` as a single number (like Elo)
- Only show μ±σ in tooltips/advanced view
- **Users see:** "Rating: 23.5" (same UX as Elo "TEI: 1450")

---

## Decision Criteria

### Choose OpenSkill (Option 3) If:

✅ **You value long-term flexibility** — team games, unified ratings  
✅ **You can wipe Firebase** — no migration needed  
✅ **You can delay launch 2 weeks** — time for implementation + testing  
✅ **You want industry-standard team rating** — not a custom workaround  
✅ **Paper revision is acceptable** — 3 days work, not a blocker  

### Choose Squad-as-Unit (Option 2) If:

✅ **You want to ship faster** — 5 days vs 12 days  
✅ **You want to minimize paper changes** — keep Elo description  
✅ **Squad rating is "nice to have"** — not core to your vision  
✅ **You prefer simple, proven math** — Elo is well-understood  

---

## Recommendation: Go with OpenSkill (Option 3)

**Given your context:**
- No users to migrate ✅
- Can wipe Firebase ✅
- Want rated squad play ✅
- Pre-launch window ✅

**This is the RIGHT time to do it.**

Post-launch, this becomes exponentially harder:
- User migrations
- Backward compatibility
- Rating inflation/deflation issues
- Dual-system maintenance

**Timeline:** 12 days to ship OpenSkill + Module Zeta rated play  
**Benefit:** Future-proof, unified rating for FFA and teams

---

## Next Steps

1. **Decision:** Confirm OpenSkill migration
2. **Install library:** `yarn add openskill`
3. **Create rating adapter:** `libs/engine/src/lib/rating/openskill-adapter.ts`
4. **Replace stats-elo.ts** with OpenSkill update functions
5. **Update Firestore schema** (wipe and restart)
6. **Calibrate reference anchors** (1K games to find μ values)
7. **Update UI** to show OpenSkill ratings
8. **Revise TEI spec** §5-6
9. **Update paper** sections on rating system
10. **Ship!**

**Ready to start? I can help scaffold the OpenSkill adapter and update functions.**
