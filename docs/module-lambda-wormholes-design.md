# Module Lambda: Wormholes — Design Document

**Status**: Design phase — awaiting implementation  
**Classification**: Warped (exhibition only)  
**Theme**: Spatial topology manipulation through wormhole generation

---

## 1. Core Concept

Module Lambda introduces **spatial inversion** as a game mechanic. Captains can open "Wormholes" that transpose their personal Warp Trail with the public Neutral Zone, fundamentally altering board state ownership.

### Key Innovation
Unlike other modules that modify scoring or add constraints, Lambda **rewrites the ownership graph** of the board state itself. This creates hostile takeover dynamics where one captain's investment becomes another's prize.

---

## 2. Mechanical Specification

### 2.1 Wormhole Trigger (Event Horizon)

**Activation Condition:**
- A captain plays a **double tile** onto the **Neutral Zone**
- The double immediately triggers a Red Alert
- **Before** Red Alert resolution, the Wormhole sequence executes

### 2.2 Spatial Inversion (The Warp)

**The Swap:**
```
OLD STATE:
  Captain A's Trail: [tiles...] (private, owned by A)
  Neutral Zone:      [tiles...] (public, open to all)

NEW STATE (after Captain A opens Wormhole):
  Captain A's Trail: [former Neutral Zone tiles] (now private to A)
  Neutral Zone:      [former Captain A tiles] (now public, open to all)
```

**Implementation Model:**
From an engine perspective, this is a pointer swap:

```typescript
const temp = round.table.warpTrails[playerId];
round.table.warpTrails[playerId] = round.table.neutralZone;
round.table.neutralZone = temp;
```

**Distress Beacon Handling:**
- If Captain A had a Distress Beacon active on their trail before the swap, it is **destroyed during transit**
- The newly established Neutral Zone (former Captain A trail) remains **permanently open** to all players (standard Neutral Zone behavior)
- Rationale: The wormhole is a "reset" event — you're escaping your dead-end trail

### 2.3 Red Alert Resolution Post-Warp

**Critical Timing:**
1. Captain plays double on Neutral Zone
2. Wormhole opens (swap happens)
3. Red Alert activates on the **new** trail (formerly the Neutral Zone)
4. Captain must satisfy Red Alert from their hand
5. If they fail → Distress Beacon deploys on their new trail

**Why This Order Matters:**
- The captain is now responsible for satisfying the Red Alert on their **newly acquired** trail
- This prevents "free escapes" — you must be able to handle the chaos you're stealing
- If you steal a long, complex trail but can't answer the double, you immediately beacon it open to everyone

---

## 3. Strategic Implications

### 3.1 Hostile Takeover
**Scenario:** Captain B has built a perfect 18-tile Warp Trail with excellent connectivity.  
**Attack:** Captain A plays a double on Neutral Zone → steals Captain B's trail  
**Result:** Captain B now "owns" the chaotic public trail Captain A was building on

### 3.2 The Escape Pod
**Scenario:** Captain C has a dead-end trail with blocked doubles and high pips.  
**Strategy:** Captain C intentionally opens a Wormhole to dump their disaster into the public sphere  
**Result:** Captain C gets a fresh start with the Neutral Zone's tiles

### 3.3 Risk Assessment
**Before opening a Wormhole, evaluate:**
- Can you answer the double you're playing? (Red Alert must be satisfied)
- Is the Neutral Zone better than your current trail?
- Will your old trail help or hurt opponents when it becomes public?

### 3.4 Defensive Play
**Preventing Theft:**
- Avoid building long, valuable personal trails when Lambda is active
- Keep the Neutral Zone chaotic (play mismatched tiles, create dead ends)
- Force opponents to draw tiles so they can't answer the Red Alert after stealing

---

## 4. AI Heuristic Challenges

### 4.1 Valuation Problem
Traditional heuristics value:
- Own trail length (good under normal rules)
- Neutral Zone chaos (neutral under normal rules)

Under Lambda:
- Own trail length = **vulnerability** (can be stolen)
- Neutral Zone order = **opportunity** (can be stolen)

### 4.2 Lookahead Complexity
The AI must evaluate:
```
if (have_double_in_hand && can_answer_red_alert_after_swap) {
  value = evaluate(neutral_zone_state) - evaluate(own_trail_state);
  if (value > threshold) {
    consider_wormhole_attack();
  }
}
```

This requires:
1. State prediction (what will the board look like after swap?)
2. Red Alert satisfaction check (can I cover the double from my new position?)
3. Opponent response modeling (how will they exploit my old trail being public?)

### 4.3 Recommended Heuristics

**wormholeOpportunity** (Module Lambda):
```typescript
score(action: WarpAiAction, ctx: WarpEvalContext): number {
  if (!lambda.enabled || action.kind !== 'chart') return 0;
  if (!isDouble(action.coordinate)) return 0;
  if (action.route.kind !== 'neutral-zone') return 0;
  
  // Can we answer the Red Alert after swap?
  const canAnswer = handHasMatchForDouble(ctx.hand, action.coordinate);
  if (!canAnswer) return -500; // Don't suicide
  
  // Is Neutral Zone better than our trail?
  const nzValue = evaluateTrailQuality(ctx.obs.round.table.neutralZone);
  const ownValue = evaluateTrailQuality(ctx.obs.round.table.warpTrails[ctx.obs.playerId]);
  
  const gain = nzValue - ownValue;
  if (gain > 10) return 50; // Strong incentive to steal good trail
  if (gain < -10) return -30; // Weak incentive (defensive trade)
  return 0;
}
```

---

## 5. Balance Considerations

### 5.1 Skill Preservation
Lambda will likely **reduce** skill ordering because:
- High-skill players invest in long-term trail building
- Lambda punishes that investment (theft risk)
- Lower-skill players benefit from randomness of who controls what

**Expected calibration:** ~50-60% higher-skill win rate (borderline Warped)

### 5.2 Game Length Impact
- May **increase** game length (more chaotic board states)
- May **decrease** game length (escape pod allows going out faster)
- Net effect unclear — requires testing

### 5.3 Interaction with Other Modules

**Synergies:**
- **Module Theta (Longest Trail)**: Creates incentive to steal long trails, then protect them
- **Module Delta (Hazard Marker)**: Wormhole + losing hazard marker = double escape
- **Module Gamma (Subspace Fracture)**: Can you steal a trail with an active fracture? (rules TBD)

**Conflicts:**
- **Module Alpha (Q-Continuum)**: Flash effects that open trails become even more chaotic
- **Module Epsilon (Draft)**: Drafted hands become less predictable when trails swap mid-game

---

## 6. Implementation Checklist

### 6.1 Engine Changes

**New Action Type:**
```typescript
interface OpenWormholeAction extends GameAction {
  type: 'OPEN_WORMHOLE';
  playerId: PlayerId;
  coordinate: Coordinate; // The double being played
  // Wormhole opens, trails swap, THEN Red Alert activates
}
```

**State Modifications:**
- [ ] Add `wormhole` module config to `GameModules`
- [ ] Implement trail swap logic in `apply-action.ts`
- [ ] Handle Distress Beacon destruction during swap
- [ ] Ensure Red Alert activates on **new** trail after swap
- [ ] Update legal moves to detect Wormhole triggers

### 6.2 AI Heuristics
- [ ] Add `wormholeOpportunity` heuristic
- [ ] Add `wormholeDefense` heuristic (avoid building valuable trails)
- [ ] Update `dumpPips` to account for theft risk
- [ ] Update `longestTrailBonus` (Module Theta) to reduce trail building under Lambda

### 6.3 UI/UX
- [ ] Add visual indicator when Wormhole is about to trigger
- [ ] Confirmation dialog: "Open Wormhole? Your trail will become public."
- [ ] Animation for trail swap (visual feedback of the topology change)
- [ ] Update game log: "Armstrong opened a Wormhole — trail swapped with the Neutral Zone"

### 6.4 Testing
- [ ] Unit tests: Trail swap mechanics
- [ ] Unit tests: Red Alert resolution post-swap
- [ ] Unit tests: Distress Beacon destruction
- [ ] Calibration: Skill ordering preservation
- [ ] Calibration: Interaction with other modules

---

## 7. Open Questions

1. **Can you steal a trail with an active Subspace Fracture?**
   - Option A: Fracture travels with the trail (you inherit the fracture)
   - Option B: Fracture is destroyed during transit (clean slate)
   - **Recommendation**: Option A (fracture travels) — more strategic depth

2. **What if multiple captains try to open Wormholes in quick succession?**
   - Standard turn order applies — first one to play double on NZ gets it
   - No "chaining" of Wormholes in a single turn

3. **Does this module work in go-out objective?**
   - **Recommendation**: Yes, but it's even more chaotic
   - Stealing a trail with 1 tile left = instant victory opportunity

4. **Should there be a limit on Wormholes per round?**
   - Option A: Unlimited (chaos mode)
   - Option B: One per captain per round (balanced)
   - **Recommendation**: Start unlimited, add limit if testing shows it's too dominant

---

## 8. Naming Alternatives

If "Wormholes" doesn't fit the theme:
- **Spatial Inversion**
- **Topology Swap**
- **Subspace Exchange**
- **Transwarp Conduit**
- **Borg Assimilation** (too aggressive?)

Current favorite: **Wormholes** (clear, iconic, fits Star Trek lore)

---

## 9. Next Steps

1. **Prototype in engine** (`libs/engine/src/lib/engine/wormhole.ts`)
2. **Write unit tests** to verify swap mechanics
3. **Add to module calibration suite**
4. **Run 500-game calibration** to measure skill preservation
5. **If skill ordering < 60%** → classify as Warped (exhibition only)
6. **If skill ordering ≥ 70%** → consider for rated play (unlikely)

---

**Document Version**: 1.0  
**Author**: Design discussion with user  
**Date**: 2026-07-12
