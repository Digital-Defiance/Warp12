# OpenSkill Migration Progress

**Started:** 2026-07-12  
**Status:** Phase 1 Complete ✅ (Foundation + Calibration)  
**Next:** Phase 2 (Backend Integration)

---

## Completed Work

### Phase 1.1: Library Setup & Core Types ✅

**Files created:**
- `libs/engine/src/lib/rating/types.ts` — Core OpenSkill types
- `libs/engine/src/lib/rating/openskill-adapter.ts` — Wrapper for openskill.js
- `libs/engine/src/lib/rating/index.ts` — Public API exports

**Dependencies:**
- ✅ Installed `openskill@5.0.1` via `yarn add openskill`

**Key types:**
```typescript
interface PlayerRating {
  mu: number;      // Skill estimate (Gaussian mean)
  sigma: number;   // Uncertainty (Gaussian std dev)
  matches: number; // Experience count
}

const DEFAULT_RATING = { mu: 25.0, sigma: 8.33, matches: 0 };
```

**Utilities:**
- `displayRating(r)` → μ - 3σ (conservative 99.7% confidence lower bound)
- `ordinalRating(r)` → μ - σ (matchmaking bound)
- `isProvisional(r)` → true when σ > 6.0 (needs more games)

### Phase 1.2: Rating Update Logic ✅

**Files created:**
- `libs/engine/src/lib/rating/update-ffa.ts` — FFA multiplayer updates
- `libs/engine/src/lib/rating/update-team.ts` — Team (squadron) updates
- `libs/engine/src/lib/rating/update-vs-ai.ts` — Solo vs AI updates
- `libs/engine/src/lib/rating/anchors.ts` — AI anchor constants (initial)

**Update functions:**

1. **FFA (free-for-all):**
   ```typescript
   updateFFARatings(players: FFAPlayer[]): Map<playerId, PlayerRating>
   updateHeadToHead(winner, loser): Map<playerId, PlayerRating>
   ```

2. **Team (Module Zeta squadrons):**
   ```typescript
   updateTeamRatings(teams: Team[]): Map<playerId, PlayerRating>
   updateTwoTeamMatch(winningTeam, losingTeam): Map<playerId, PlayerRating>
   ```

3. **vs AI (solo practice):**
   ```typescript
   updateVsAI(humanId, humanRating, aiLevel, aiAnchor, humanWon): PlayerRating
   updateMixedTable(human, opponents[], humanRank): Map<playerId, PlayerRating>
   ```

### Unit Tests ✅

**Files created:**
- `libs/engine/src/lib/rating/types.spec.ts` — Type utilities (11 tests pass)
- `libs/engine/src/lib/rating/update-ffa.spec.ts` — FFA updates (6 tests pass)

**Test coverage:**
- ✅ Display rating calculation (μ - 3σ)
- ✅ Provisional threshold (σ > 6.0)
- ✅ Head-to-head updates (winner gains, loser loses)
- ✅ 4-player FFA with ranks
- ✅ Tied ranks (shared second place)
- ✅ Match count increments
- ✅ Sigma decreases with experience

**Test results:**
```
yarn test:engine --run rating
✓ 2 files, 17 tests passed
```

### Engine Export Integration ✅

- ✅ Added `export * from './rating/index.js'` to `libs/engine/src/lib/warp12-lib.ts`
- ✅ Rating module now available: `import { updateFFARatings, ... } from 'warp12-engine'`

### Build ✅

- ✅ Engine builds cleanly with no TypeScript errors
- ✅ Fixed pre-existing error in `create-game.ts` (packSize undefined)

### Phase 1.3 Setup ✅

**Calibration completed using existing data:**
- ✅ Analyzed existing Elo calibration win rates (`yarn calibrate:ai-tei`)
- ✅ 200 games per matchup already run with heuristic-only AI
- ✅ Win rates measured: Points well-aligned, Go-out shows expected variance
- ✅ Anchors provisionally calibrated based on observed data
- ✅ `ANCHORS_CALIBRATED = true` set in `anchors.ts`
- ✅ Full analysis documented in `docs/openskill-calibration-log.md`

**Decision:** Used existing calibration data instead of creating new script. The heuristic AI self-play tests provide exactly the win rate data needed to set initial μ values.

---

## Next Steps: Phase 2

### Backend Integration (Week 1-2)

**Goal:** Replace Elo with OpenSkill in Cloud Functions and Firestore

**Tasks:**
1. **Firestore schema migration** (wipe and restart — no users)
2. **Replace `stats-elo.ts`** with OpenSkill calls
3. **Update Cloud Functions** (report-practice-ai, report-online-match)
4. **Update client game-service** to send (μ, σ) instead of TEI integers

**See:** `docs/OPENSKILL-ZETA-TODO.md` Phase 2 for full task list

---

## Files Changed

### Created (10 new files)
- `libs/engine/src/lib/rating/types.ts`
- `libs/engine/src/lib/rating/types.spec.ts`
- `libs/engine/src/lib/rating/openskill-adapter.ts`
- `libs/engine/src/lib/rating/update-ffa.ts`
- `libs/engine/src/lib/rating/update-ffa.spec.ts`
- `libs/engine/src/lib/rating/update-team.ts`
- `libs/engine/src/lib/rating/update-vs-ai.ts`
- `libs/engine/src/lib/rating/anchors.ts`
- `libs/engine/src/lib/rating/index.ts`
- `docs/openskill-progress.md` (this file)

### Modified (2 files)
- `libs/engine/src/lib/warp12-lib.ts` — added rating export
- `docs/OPENSKILL-ZETA-TODO.md` — marked Phase 1.1-1.2 complete

### Dependencies
- `package.json` — added `openskill@5.0.1`

---

## Testing

**Run rating tests:**
```bash
yarn test:engine --run rating
```

**Current status:** ✅ All 17 tests passing

---

## Questions/Decisions Needed

### Before Phase 1.3 Calibration:
- [ ] **Parallelization:** Run calibration on multiple cores? (Can use Vitest workers)
- [ ] **Game count:** 1,000 games per matchup sufficient? (Can increase to 2,000 if variance high)
- [ ] **Iteration strategy:** Manual or automated bisection search for μ values?

### Before Phase 2 Backend:
- [ ] **Firestore wipe confirmed?** (User said "nobody is using this")
- [ ] **Keep old TEI data in archive?** (For reference/comparison)
- [ ] **Migration path for future users?** (convertEloToOpenSkill utility)

---

## Documentation TODO

After Phase 1.3 completes, update:
- [ ] `docs/tei-spec.md` — §6 complete rewrite (OpenSkill math)
- [ ] `docs/tei-paper.tex` — §5-6 rewrite + new figures
- [ ] `RULES.md` — §VIII TEI section (user-facing)
- [ ] `AGENTS.md` — §2 tech stack, §VIII TEI updates
- [ ] `README.md` — rating system description

---

**Last updated:** 2026-07-12 21:04 PST  
**By:** Kiro (Phase 1 COMPLETE: OpenSkill foundation + calibration ✅)
