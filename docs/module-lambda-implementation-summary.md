# Module Lambda: Wormholes — Implementation Summary

**Date**: 2026-07-12  
**Status**: ✅ Complete — Engine + Tests + UI  
**Classification**: Warped (exhibition only, predicted ~50-60% skill preservation)

---

## Overview

Module Lambda (Wormholes) introduces spatial topology manipulation as a game mechanic. When a captain plays a double on the Neutral Zone, their personal Warp Trail swaps with the Neutral Zone, fundamentally altering board state ownership.

This creates hostile takeover dynamics where one captain's investment becomes another's prize, and provides escape pod strategies for captains stuck with dead-end trails.

---

## Implementation Complete

### 1. Engine (warp12-engine) ✅

**Files Modified:**
- `libs/engine/src/lib/types/modules.ts` - Added `WormholesModule` interface and config
- `libs/engine/src/lib/engine/apply-action.ts` - Added `executeWormholeSwap()` function and integration
- `libs/engine/src/lib/ai/module-calibration.spec.ts` - Added Lambda configs for testing

**Core Logic (`apply-action.ts`):**
```typescript
function executeWormholeSwap(round: RoundState, playerId: string): RoundState {
  // Swap captain's trail with Neutral Zone
  // Destroy distress beacon during transit (fresh start)
  // Return updated round state
}
```

**Trigger Conditions:**
1. Module Lambda is enabled (`modules.wormholes.enabled`)
2. Player charts a **double** onto the **Neutral Zone**
3. Swap occurs **after** the double is placed on NZ
4. Red Alert is then triggered on the captain's **newly acquired** trail

**Mechanics:**
- Player's trail tiles → Neutral Zone
- Neutral Zone tiles → Player's trail
- Distress beacon on player's trail is destroyed
- Red Alert responsibility is on the player's new trail (which now contains the double)

### 2. Tests ✅

**Test File:** `libs/engine/src/lib/engine/wormhole.spec.ts`

**Test Coverage (6 tests, all passing):**
1. ✅ Swaps captain trail with neutral zone when double played on NZ
2. ✅ Triggers red alert on newly acquired trail after swap
3. ✅ Destroys distress beacon during wormhole transit
4. ✅ Does not trigger wormhole when module disabled
5. ✅ Only triggers wormhole on doubles, not regular tiles
6. ✅ Hostile takeover scenario - stealing built neutral zone

**Run Tests:**
```bash
yarn test:engine --run wormhole.spec.ts
```

### 3. UI/React (warp12-react) ✅

**Files Modified:**
- `libs/react/src/hand/game-log.ts` - Added wormhole effect detection and message

**Game Log Integration:**
- Added `'wormhole-opened'` to `GameLogEffect` type
- Detection: Checks trail length changes before/after double play on NZ
- Message: `"opening a Wormhole — trail swapped with the Neutral Zone"`

**Example Log Output:**
```
Armstrong charts 9-9 onto the Neutral Zone, opening a Wormhole — trail swapped with the Neutral Zone, causing a Red Alert
```

### 4. Rules Documentation ✅

**Files Updated:**
- `RULES.md` - Added Module Lambda section (after Kappa, before Epsilon)
- `RULES.tex` - Added Module Lambda LaTeX section
- `docs/module-lambda-wormholes-design.md` - Complete design document

**RULES.md Section:**
- Classification: Warped (exhibition only)
- Mechanic description with examples
- Strategic implications (hostile takeover, escape pod, risk assessment)
- Tactical impact analysis
- Status: Exhibition/Warped mode only, predicted ~50-60% skill preservation

---

## How to Use

### Enable in Game Setup

```typescript
const game = createLobbyState({
  id: 'wormhole-test',
  captains: [...],
  modules: {
    wormholes: true,
  },
});
```

### Gameplay

1. Build up your Warp Trail (or let opponents build up the Neutral Zone)
2. When you have a double matching the Neutral Zone's open value
3. Play the double on the Neutral Zone
4. **Wormhole opens**: Your trail and NZ swap ownership
5. Red Alert triggers on your new trail — you must satisfy it
6. If you can't satisfy the Red Alert, you deploy a beacon on your new trail

---

## Strategic Considerations

### Offensive: Hostile Takeover
**Scenario:** Opponent has built a long, valuable trail  
**Strategy:** Play double on Neutral Zone to steal their progress  
**Risk:** Must be able to answer the Red Alert on the stolen trail

### Defensive: Escape Pod
**Scenario:** Your trail is blocked with dead doubles and high pips  
**Strategy:** Dump your disaster into the public Neutral Zone  
**Result:** Fresh start with whatever was on the NZ

### Risk Management
**Before opening a Wormhole:**
- ✅ Can you answer the Red Alert after the swap?
- ✅ Is the Neutral Zone better than your current trail?
- ✅ Will your old trail help or hurt opponents when it becomes public?

---

## Technical Details

### Red Alert Handling After Wormhole

The trickiest part of the implementation was handling Red Alert correctly after a wormhole swap:

**Problem:** When a double is played on neutral-zone, the engine creates a Red Alert with `trailPlayerId = ''` (empty, meaning it's on the public NZ). But after a wormhole, that double is now on the captain's **private** trail.

**Solution:** 
1. Added `wormholeSwapped` boolean parameter to `resolvePostChartAnomalies()`
2. When wormhole occurred, set `trailPlayerId = playerId` instead of empty string
3. This ensures Red Alert responsibility is correctly assigned to the captain's new trail

### Module Detection in Game Log

**Challenge:** How to detect that a wormhole occurred from before/after state?

**Solution:** Compare trail and NZ lengths before and after the action:
```typescript
const wormholeOpened = 
  isDouble(coordinate) &&
  route.kind === 'neutral-zone' &&
  (afterTrailLength ≈ beforeNzLength + 1) &&  // Player got NZ + double
  (afterNzLength ≈ beforeTrailLength);         // NZ got player's old trail
```

---

## Calibration Status

Module Lambda is included in the calibration matrix as:
- `warped-lambda` (Lambda only)
- `warped-ultimate` (all warped modules: Iota + Kappa + Lambda)

**Expected Skill Preservation:** ~50-60%  
**Rationale:** High-skill players invest in long-term trail building, which Lambda punishes via theft risk. Lower-skill players benefit from the randomness of dynamic ownership changes.

**Run Calibration:**
```bash
MODULE_CALIBRATION_GAMES=500 yarn calibrate:modules
```

---

## Build & Test Commands

```bash
# Build engine with Lambda support
yarn build:engine

# Run wormhole tests
yarn test:engine --run wormhole.spec.ts

# Build React lib with game log support
yarn build:react

# Build Bridge app
yarn build:bridge

# Full calibration (includes Lambda)
MODULE_CALIBRATION_GAMES=500 yarn calibrate:modules
```

---

## Future Enhancements

### Potential Additions
1. **Visual Animation**: Animate the trail swap in the UI
2. **Confirmation Dialog**: "Open Wormhole? Your trail will become public."
3. **AI Heuristics**: Add `wormholeOpportunity` and `wormholeDefense` heuristics
4. **Sound Effect**: Unique sound for wormhole opening
5. **Statistics**: Track wormhole usage in match stats

### Open Design Questions
1. Should there be a limit on wormholes per round? (Currently unlimited)
2. Should wormholes work with active Subspace Fractures? (Currently yes, fracture travels with the trail)
3. Should wormholes be available in go-out objective? (Currently yes, creates chaos)

---

## References

- **Design Doc**: `/Volumes/Code/Warp12/docs/module-lambda-wormholes-design.md`
- **Rules**: `/Volumes/Code/Warp12/RULES.md` (Module Lambda section)
- **Engine**: `/Volumes/Code/Warp12/libs/engine/src/lib/engine/apply-action.ts`
- **Tests**: `/Volumes/Code/Warp12/libs/engine/src/lib/engine/wormhole.spec.ts`
- **UI**: `/Volumes/Code/Warp12/libs/react/src/hand/game-log.ts`

---

## Completion Checklist

- [x] Module type definition (`WormholesModule`)
- [x] Engine swap logic (`executeWormholeSwap`)
- [x] Red Alert handling after swap
- [x] Distress beacon destruction
- [x] Unit tests (6 tests, all passing)
- [x] Game log integration
- [x] RULES.md documentation
- [x] RULES.tex documentation
- [x] Calibration config added
- [x] Builds successfully (engine + react + bridge)
- [x] Implementation summary document

**Status: Ready for playtesting! 🚀**
