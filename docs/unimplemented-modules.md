# Unimplemented Modules

This document tracks modules that are defined in the engine types but not yet fully implemented or integrated into gameplay.

---

## Module Epsilon — Tactical Requisition (Drafting)

**Status:** Types defined, logic NOT implemented  
**Classification:** Exhibition/Experimental  
**Greek Letter:** Ε ε (Epsilon)

### Concept
Pre-mission draft instead of random deal. Captains take turns selecting tiles from packs to build their starting hands.

### What Exists
- `DraftingModule` interface in `libs/engine/src/lib/types/modules.ts`
- Configuration fields: `enabled`, `packSize`
- Default values: `packSize: 15` for 2-player W12

### What's Missing
- `dealRoundFromDraft()` function - the actual drafting logic
- Draft UI for tile selection
- Turn order for drafting (e.g., snake draft)
- Integration with round creation

### Design Notes
- Requires significant UI work (interactive tile selection)
- Transforms round start from luck-based to skill-based
- May significantly increase game length
- Skill ordering impact unknown (needs calibration)

---

## Module Zeta — Fleet Squadrons (Warp Crews)

**Status:** Types defined, logic NOT implemented  
**Classification:** Exhibition/Experimental  
**Greek Letter:** Ζ ζ (Zeta)

### Concept
Team play mode where 2-3 captains form squadrons with shared trails and resources.

### What Exists
- `SquadronsModule` interface in `libs/engine/src/lib/types/modules.ts`
- Configuration fields: `enabled`, `squadronSize`
- Default values: `squadronSize: 2`

### What's Missing
- Squadron formation logic
- Shared trail mechanics
- Team scoring system
- Squadron coordination rules
- UI for team indicators

### Design Notes
- Fundamentally changes game from competitive to cooperative
- Requires 4+ players minimum (2 squadrons of 2)
- Complex interaction with existing modules
- Best suited for Warp 18 (18-captain sectors)

---

## Module Eta — Temporal Debt (Draw Tax)

**Status:** ✅ **IMPLEMENTED** (January 2025)  
**Classification:** Rated (pending calibration)  
**Greek Letter:** Η η (Eta)

### Concept
Each draw from Uncharted Sectors accumulates +1 debt token. Pay `costPerToken` points per token at round end.

### Implementation Complete
- ✅ Types defined (`TemporalDebtModule`)
- ✅ Debt token tracking (`debtTokens` in `RoundState`)
- ✅ Increment on `DRAW_FROM_UNCHARTED`
- ✅ Scoring penalty applied at round end
- ✅ Default cost: 2 points per token

### Still Needed
- UI checkbox in lobbies (local + online + charter)
- HUD display showing debt tokens
- Calibration testing (skill preservation)
- RULES.md documentation
- AI heuristics (optional)

---

## Summary Table

| Module | Letter | Status | Engine | UI | Calibrated | Classification |
|---|---|---|---|---|---|---|
| Alpha (Continuum) | Α α | ✅ Shipped | ✅ | ✅ | ✅ | Rated |
| Beta (Salamander) | Β β | ✅ Shipped | ✅ | ✅ | ✅ | Rated |
| Gamma (Sensor Grid) | Γ γ | ✅ Shipped | ✅ | ✅ | ✅ | Rated |
| Delta (Hot Potato) | Δ δ | ✅ Shipped | ✅ | ✅ | ✅ | Rated |
| **Epsilon (Drafting)** | Ε ε | ❌ Not Implemented | ⚠️ Types only | ❌ | ❌ | Exhibition |
| **Zeta (Squadrons)** | Ζ ζ | ❌ Not Implemented | ⚠️ Types only | ❌ | ❌ | Exhibition |
| **Eta (Temporal Debt)** | Η η | ⚠️ **Engine Done, UI Pending** | ✅ | ❌ | ❌ | Rated (predicted) |
| Theta (Longest Trail) | Θ θ | ✅ Shipped | ✅ | ✅ | ✅ | Rated |
| Iota (Double Down) | Ι ι | ✅ Shipped | ✅ | ✅ | ✅ | Rated |
| Kappa (Temporal Inversion) | Κ κ | ✅ Shipped | ✅ | ✅ | ✅ | Warped |
| Lambda (Wormholes) | Λ λ | ✅ Shipped | ✅ | ✅ | ⚠️ Pending | Warped |

---

## Next Steps

### Immediate (Module Eta)
1. Add UI checkboxes to all lobbies
2. Display debt tokens in Sector Status HUD
3. Run calibration tests
4. Document in RULES.md

### Future (Epsilon & Zeta)
1. Design detailed mechanics
2. Implement engine logic
3. Build UI components
4. Extensive calibration (likely exhibition-only)

---

**Last Updated:** January 2025
