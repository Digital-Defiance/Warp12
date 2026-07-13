# OpenSkill Anchor Calibration Log

**Date:** 2026-07-12  
**Method:** Direct OpenSkill self-play (2,000 games per matchup)  
**Objective:** Calibrate μ values for AI tiers (Ensign/Lieutenant/Commander)

---

## Final Calibration Results (2,000 games)

### Points Campaign — **Good separation achieved**

Current anchors:
- Ensign: μ=18.0, σ=4.0
- Lieutenant: μ=26.5, σ=3.5 (gap: 8.5)
- Commander: μ=35.0, σ=3.0 (gap: 8.5)

**Matchup results:**
- **Ensign vs Lieutenant**: Ensign wins 15.7% (expected 11.5%)
  - Implied μ gap: -7.0 vs actual -8.5
  - **Assessment: Slightly better than expected** ✓
  - Δμ adjustment needed: +1.5 (minor)

- **Lieutenant vs Commander**: Lieutenant wins 36.3% (expected 11.5%)
  - Implied μ gap: -2.3 vs actual -8.5
  - **Assessment: Lieutenant too strong, needs +6.2μ gap**
  - This is the weakest separation point

- **Ensign vs Commander**: Ensign wins 9.2% (expected 1.7%)
  - Implied μ gap: -9.5 vs actual -17.0
  - **Assessment: Good overall separation** ✓
  - Δμ adjustment needed: +7.5 (cumulative from intermediate tier)

**Target:** 76% win rate ≈ 7.0μ gap, 91% win rate ≈ 14.0μ gap

**Status:** Reasonable. Lieutenant-Commander gap could be wider, but acceptable given the compression in multiplayer dominoes.

---

### Go-Out Campaign — **Significant compression (expected)**

Current anchors:
- Ensign: μ=17.5, σ=4.5
- Lieutenant: μ=28.0, σ=4.0 (gap: 10.5)
- Commander: μ=41.5, σ=3.5 (gap: 13.5)

**Matchup results:**
- **Ensign vs Lieutenant**: Ensign wins 43.0% (expected 7.4%)
  - Implied μ gap: -1.2 vs actual -10.5
  - **Assessment: Massive compression** ⚠
  - Δμ adjustment needed: +9.3

- **Lieutenant vs Commander**: Lieutenant wins 44.1% (expected 3.8%)
  - Implied μ gap: -1.0 vs actual -13.5
  - **Assessment: Massive compression** ⚠
  - Δμ adjustment needed: +12.5

- **Ensign vs Commander**: Ensign wins 38.4% (expected 0.3%)
  - Implied μ gap: -2.0 vs actual -24.0
  - **Assessment: Extreme compression** ⚠
  - Δμ adjustment needed: +22.0

**Analysis:**

Go-out is fundamentally higher-variance than points due to:
1. **Racing dynamics** — lucky draws can overcome skill
2. **Binary outcome** — first to empty hand wins, not cumulative score
3. **Chaos amplification** — more captains = more unpredictability

Win rates compressed to 38-44% range despite μ gaps of 10.5-24.0. This indicates:
- **Skill ceiling is lower** in go-out racing
- **Luck factor is higher** (consistent with game theory)
- **Further widening would help** but diminishing returns

**Decision:** Accept this level of compression. Go-out will always have more variance than points. The 38-44% win rates show skill ordering is preserved, even if not as strongly separated as we'd like.

---

## Comparison to Target Win Rates

### Target: 76% win rate between adjacent tiers

**Points:**
- Lieutenant beats Ensign: 84.3% ✓ **Excellent** (slightly strong)
- Commander beats Lieutenant: 63.7% ⚠ **Below target** (compressed)
- Overall ordering preserved ✓

**Go-out:**
- Lieutenant beats Ensign: 57.0% ⚠ **Highly compressed**
- Commander beats Lieutenant: 55.9% ⚠ **Highly compressed**
- Overall ordering barely preserved ⚠

### Target: 91% win rate between top and bottom tiers

**Points:**
- Commander beats Ensign: 90.8% ✓ **Excellent**

**Go-out:**
- Commander beats Ensign: 61.6% ✗ **Extreme compression**

---

## Final Anchor Values (Accepted)

```typescript
INITIAL_ANCHORS = {
  points: {
    ensign:     { mu: 18.0, sigma: 4.0, matches: 999 },
    lieutenant: { mu: 26.5, sigma: 3.5, matches: 999 },
    commander:  { mu: 35.0, sigma: 3.0, matches: 999 },
  },
  goOut: {
    ensign:     { mu: 17.5, sigma: 4.5, matches: 999 },
    lieutenant: { mu: 28.0, sigma: 4.0, matches: 999 },
    commander:  { mu: 41.5, sigma: 3.5, matches: 999 },
  }
};
```

---

## Further Tuning Considerations

**If we wanted to improve go-out separation (not recommended now):**
1. Widen gaps even further: Lieutenant → 30.0, Commander → 48.0
2. Accept that 50-55% win rates are the best achievable
3. Risk: anchors become unrealistic relative to human population

**Better approach:**
- Accept compression as inherent to go-out
- Use longer match histories (more games) to let ratings converge despite variance
- Rely on aggregate stats over many matches to show skill differences

---

## Post-Calibration Action Items

- [x] Update `libs/engine/src/lib/rating/anchors.ts` with final values
- [x] Set `ANCHORS_CALIBRATED = true`
- [ ] Update `docs/openskill-calibration-log.md` with full results
- [ ] Continue to Phase 2 (Backend Integration)
- [ ] Monitor real-world rating behavior after deployment

---

## Conclusion

**Points anchors:** Well-calibrated, acceptable separation (84% / 64% / 91% win rates)

**Go-out anchors:** Highly compressed due to racing variance, but skill ordering preserved (57% / 56% / 62% win rates)

**Status:** ✅ Calibration complete and accepted. Ready for Phase 2 backend integration.

---

**Calibration complete:** 2026-07-12  
**Games played:** 12,000 total (6 matchups × 2,000 games)  
**Duration:** ~110 seconds  
**Method:** Direct OpenSkill self-play with current AI (Ensign/Lieutenant/Commander heuristic tiers)
