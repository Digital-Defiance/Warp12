# Module Integration TODO

**Last Updated**: January 2025  
**Status**: AI heuristics complete ✅ | UI integration complete ✅ | Some test failures remain ⚠️

## 🎯 READY FOR 19K COMPREHENSIVE STUDY

The AI now understands all module mechanics strategically! All 45 module calibration tests pass.

**Next step**: Run the comprehensive luck/skill study once the remaining test failures are fixed.

```bash
COMPREHENSIVE_GAMES=500 \
COMPREHENSIVE_WORKERS=15 \
bash tools/nn/run-comprehensive-parallel-fine.sh
```

---

## ⚠️ KNOWN TEST FAILURES (Non-blocking for AI work)

These test failures are in the engine's spool/scoring mechanics, NOT in the AI heuristics:

- **Warp Drive Spool tests** (8 failures): `warp-drive-spool.spec.ts`
  - Basic spool mechanics expecting different success/failure behavior
  - Red Alert/Fracture handling during spool
- **Module Theta scoring tests** (3 failures): `warp-drive-spool-scoring.spec.ts`
  - Longest trail bonus not being applied correctly in scoring
  - Expected -1 bonus, getting 0
- **Random play harness** (1 failure): Test timeout on baseline config

These need to be fixed but don't block AI heuristics work or calibration.

---

## ✅ COMPLETED

### P0 - Critical (Blocks Usage)
- [x] Add setup checkboxes for Gamma, Delta, Theta, Iota, Kappa in:
  - [x] `lobby-form.tsx` (online lobby)
  - [x] `local-game-page.tsx` (solo vs AI)
  - [x] `pass-and-play-page.tsx` (local multiplayer)
  - [x] `online-lobby-page.tsx` (online waiting room)
- [x] Update sector settings dialog to display all modules
- [x] Update RULES.md with calibration results (rated status)
- [x] Fix hazard marker penalty tooltips ("+5 per pass" not "+10")
- [x] Add dynamic pass count to hazard marker HUD display
- [x] Add Temporal Inversion warning banner in HUD

---

## 🔧 IN PROGRESS / TODO

### P1 - Important (Confusing Without)

#### Double Down Notification
- [x] **Action log entry** when Double Down triggers
  - `buildGameLogEntry` / `formatGameLogEntry` in `libs/react/.../game-log.ts`
  - Format: `… played … → Double Down! [Target] draws N`
- [x] **Visual notification** (toast/banner) when tiles are forcibly drawn
  - `module-feedback.ts` + `bridge-table.tsx` (local dispatch + online move-log sync)
- [x] **HUD indicator** on the affected captain's turn
  - `sector-status-hud.tsx` Double Down row while notice is active

#### Spool Action Button
- [x] **SPOOL_WARP_DRIVE control** next to Draw when `getSpoolOptions` is non-empty
  - Label: “Engage warp drive”; multi-route picker when needed
- [x] **Spool result summary** via `formatSpoolFeedback` toast
  - One-by-one draw animation left as P2
- [~] **Spool feedback** tile-by-tile animation (P2)

#### Firebase Schema Verification
- [x] **Verify all new module fields** serialize/deserialize correctly (2026-07-13)
  - [x] `schema.ts` — sensorGrid, draftState, hazard marker, debtTokens, wormholeOpened, round.squadrons + trailKey
  - [x] `serialize.ts` / `mergeHandsIntoGame` round-trip
  - [x] `mergeCaptainMetadata` preserves `squadronId`
  - [x] Online lobby toggles for Eta / Epsilon / Lambda (Zeta already present; local/P&amp;P intentionally omit Zeta)

---

### P2 - Nice to Have (Polish)

#### Visual Polish
- [ ] **Double Down animation** when tiles are added to hand
- [ ] **Longest Trail bonus indicator** in end-of-round summary
  - Show "[Player] longest trail (-3 bonus)" in scoring display
- [ ] **Temporal Inversion reminder** on round start
  - Toast: "Round X - Inverted Scoring (highest wins)"
- [ ] **Spool animation** showing tiles being drawn sequentially

#### Preset Configurations
- [ ] **Add Tournament Elite preset** to warp12-preset.ts
  ```typescript
  export const TOURNAMENT_ELITE_MODULES: GameModuleConfig = {
    continuum: true,
    salamanderPenalty: true,
    sensorGrid: true,
    warpDriveSpool: true,
    longestTrail: true,
  };
  ```
- [ ] **Add Warped Chaos preset**
  ```typescript
  export const WARPED_CHAOS_MODULES: GameModuleConfig = {
    doubleDown: true,
    temporalInversion: true,
  };
  ```
- [ ] **Add preset buttons** to setup UI

---

## ✅ AI STRATEGIC UNDERSTANDING (COMPLETED)

### Critical for 19K Comprehensive Study

**STATUS**: AI heuristics implemented and tested successfully! All 45 module calibration tests pass.

#### Module Theta: Longest Trail Bonus ✅
- [x] **Heuristic: Trail length value** (`ai/heuristics.ts`)
  - ✅ Increase value of own-trail plays when trailing in length (+3 per tile gap)
  - ✅ Add bonus for plays that extend trail significantly (+8 when leading, +12 late game)
  - ✅ Balance against other objectives (only affects points campaigns, not go-out)
- [x] **Spool decision logic** (`ai/spool-strategy.ts`)
  - ✅ When to spool on own trail vs Neutral Zone (gap-based incentives)
  - ✅ Risk assessment: potential for drawing Salamander (existing logic preserved)
  - ✅ Late-game aggressive spooling for trail bonus (+50 in very late game)
- [x] **Opponent trail length tracking**
  - ✅ Added to game state analysis (maxOpponentTrailLen calculation)
  - ✅ Defensive plays when opponent is building long trail (maintain lead +8 bonus)

#### Module Iota: Double Down ✅
- [x] **Heuristic: Double timing** (`ai/heuristics.ts`)
  - ✅ Delay playing doubles when opponent has few tiles (maximize burden: +25 when ≤3 tiles)
  - ✅ Play doubles early when opponent has many tiles (less impact: 0 bonus)
  - ✅ Consider double timing in going-out strategy (stronger bonuses in go-out mode)
- [x] **Hand management with forced draws**
  - ✅ AI understands next player gets +2 tiles when double is played
  - ✅ Strategic timing based on next player's hand size

#### Module Kappa: Temporal Inversion ✅
- [x] **Objective inversion awareness** (`ai/heuristics.ts`)
  - **Even rounds**: Completely inverted strategy
    - ✅ DO NOT go out (catastrophic: -1000 penalty prevents going out)
    - ✅ KEEP high-pip tiles instead of shedding (-0.8 × pipValue in dumpPips)
    - ✅ Target medium hand size (~40 pips: +30 draw bonus when low)
  - **Odd rounds**: Normal strategy (no changes)
- [x] **Round-aware tile retention**
  - ✅ Even rounds: Hold valuable tiles (prefer playing low-value tiles: +8 for 0-6 pips)
  - ✅ Odd rounds: Normal aggressive play (dumpPips and goOutWin work normally)
- [x] **Going-out prevention on even rounds**
  - ✅ Block plays that would empty hand (-1000 penalty in goOutWin prevents this)
  - ✅ Draw intentionally to maintain hand size (+30 draw bonus on inverted rounds)

#### Module Gamma: Sensor Grid
- [x] **Existing AI support** (no new heuristics needed)
  - ✅ AI already prefers visible tiles when available
  - ✅ Draw decision logic works with sensor grid
  - ✅ No strategic changes needed - module is skill-neutral by design

#### Module Delta: Hot Potato (Hazard Marker)  
- [x] **Neutral Zone strategy** when holding hazard (`ai/spool-strategy.ts`)
  - ✅ EXISTING: +60 bonus for clearing hazard via NZ spool
  - ✅ Comprehensive risk/reward calculation in spool-strategy.ts
- [x] **Forced pass awareness**
  - ✅ AI understands +5 penalty per pass when holding hazard
  - ✅ Aggressive NZ play to clear hazard and avoid passing
- [x] **Strategic hazard transfer**
  - ✅ Transfer to opponents via NZ spool (existing logic)

#### Combined Module Synergies ✅
- [x] **Delta + Theta interaction**
  - ✅ Hazard pushes toward NZ (+60), longest trail pulls toward own trail (gap × 12)
  - ✅ Strategic tension in spool target selection (risk/reward balanced)
- [x] **Iota + Kappa chaos**
  - ✅ Double Down adds variance to hand sizes (timing heuristic)
  - ✅ Makes even-round hand management harder (temporal inversion strategy adapts)

---

## 📊 COMPREHENSIVE LUCK/SKILL STUDY

After AI understands all modules, run the 19K-game study:

### Study Configuration
```bash
# 38 configurations × 500 games = 19,000 games
# ~40 minutes with 15 workers on M4 Max

COMPREHENSIVE_GAMES=500 \
COMPREHENSIVE_WORKERS=15 \
bash tools/nn/run-comprehensive-parallel-fine.sh
```

### Configurations to Test
1. Baseline (no modules)
2. Alpha (Continuum)
3. Beta (Salamander)
4. Alpha + Beta (Official Warp Core)
5. Gamma (Sensor Grid)
6. Delta (Hot Potato)
7. Theta (Longest Trail)
8. Iota (Double Down)
9. Kappa (Temporal Inversion)
10. Gamma + Delta
11. Delta + Theta
12. Beta + Theta
13. Alpha + Beta + Gamma
14. Alpha + Beta + Delta
15. Alpha + Beta + Theta
16. Alpha + Beta + Gamma + Delta (Official Warp Core)
17. **Alpha + Beta + Gamma + Delta + Theta (Tournament Elite)** ⭐
18. Alpha + Beta + Gamma + Delta + Iota
19. Gamma + Delta + Theta
20. All rated modules (A+B+G+D+T+I)
21. Iota (standalone)
22. Kappa (standalone)
23. Iota + Kappa (Warped Chaos)
24-38. Additional combinations for interaction analysis

### Study Goals
- **Skill preservation across all combinations**
- **Module interaction effects** (synergies, conflicts)
- **Optimal module subsets** for different player preferences
- **Variance analysis** (which combinations increase/decrease luck factor)
- **TEI calibration data** for Tournament Elite preset

---

## 🔬 TESTING CHECKLIST

Before declaring modules "production ready":

### Unit Tests
- [x] Module calibration tests pass (all 46 tests)
- [ ] AI heuristics tests for new modules
- [ ] Spool strategy tests

### Integration Tests
- [ ] Local game with each module enabled
- [ ] Online game with each module enabled
- [ ] Pass-and-play with each module enabled
- [ ] Tournament Elite preset (all rated modules together)
- [ ] Warped Chaos preset (Iota + Kappa)

### UI/UX Tests
- [x] Setup checkboxes work in all 4 contexts
- [x] Sector settings dialog displays all modules correctly
- [x] Temporal Inversion banner appears on even rounds
- [ ] Double Down notification shows when triggered
- [ ] Spool button appears when Delta/Theta enabled
- [ ] Hazard marker pass count updates correctly
- [ ] Longest trail display updates correctly

### Firebase Tests
- [ ] Module state syncs correctly in online games
- [ ] All module fields serialize/deserialize
- [ ] Online game with new modules completes successfully
- [ ] TEI calculation works with new modules (if rated)

---

## 📝 DOCUMENTATION TODO

- [ ] **Update TEI paper** with new module calibration data
- [ ] **Add module strategy guide** to RULES.md
  - When to enable each module
  - Strategic tips for each module
  - Recommended combinations
- [ ] **Update AGENTS.md** with module development notes
- [ ] **Create module changelog** documenting calibration results

---

## 🎯 PRIORITY ORDER

1. **AI Strategic Understanding** (blocks 19K study)
   - Start with Kappa (most critical - inverts everything)
   - Then Theta (longest trail heuristics)
   - Then Iota (double timing)
   - Then Gamma (visible market)
   - Then Delta polish (already has basic support)

2. **Double Down Notification** (confusing without)

3. **Spool Action Button** (needed for manual testing)

4. **19K Comprehensive Study** (once AI is ready)

5. **Polish & Presets** (last)

---

## 🚀 ESTIMATED EFFORT

- AI heuristics (all modules): **4-6 hours**
- Double Down notification: **1-2 hours**
- Spool button UI: **1-2 hours**
- Firebase verification: **30 min**
- Testing: **2-3 hours**
- 19K study + analysis: **2-3 hours**

**Total: ~15-20 hours to full production readiness**
