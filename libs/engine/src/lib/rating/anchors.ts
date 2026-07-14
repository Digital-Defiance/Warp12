/**
 * Reference AI anchor ratings — fixed (μ, σ) values for Ensign/Lieutenant/Commander.
 * These are calibrated via self-play (Phase 1.3 complete).
 *
 * OpenSkill mapping (calibrated from 2,000-game self-play runs):
 * - Points: μ gaps of ~8.5 points (84%/64% win rates, target 76%)
 * - Go-out: μ gaps of ~10.5/13.5 points (compressed, 57%/56% win rates)
 * - σ = 4.0 for Ensign (moderate uncertainty)
 * - σ = 3.5 for Lieutenant (more certain)
 * - σ = 3.0 for Commander (most certain)
 */

import type { PlayerRating, RatingTrack } from './types.js';
import type { AiSkillLevel } from './update-vs-ai.js';

/**
 * AI anchor ratings — fixed (μ, σ) values for Ensign/Lieutenant/Commander.
 * 
 * **Status:** CALIBRATED (500-game self-play, 2026-07-12)
 * 
 * Calibration results (500 games per matchup):
 * 
 * **Points Campaign:**
 * - Ensign vs Lieutenant: 14.2% (target ~15%) ✓ Excellent
 * - Lieutenant vs Commander: 38.0% (target ~15%) → Adjusted
 * - Ensign vs Commander: 10.2% (target ~3%) → Adjusted
 * 
 * **Go-Out Campaign:**
 * - High compression due to racing/luck (42-44% win rates)
 * - Widened gaps significantly to achieve skill separation
 * - Some compression is unavoidable in go-out objective
 * 
 * Adjustments made:
 * - Points: Widened Lieutenant-Commander and Ensign-Commander gaps
 * - Go-Out: Major widening across all tiers to combat compression
 * 
 * See: docs/openskill-calibration-log.md for full analysis
 */
export const INITIAL_ANCHORS: Record<
  RatingTrack,
  Record<AiSkillLevel, PlayerRating>
> = {
  points: {
    ensign: {
      mu: 18.0, // Weakest tier
      sigma: 4.0,
      matches: 999, // Fixed anchor, never updates
    },
    lieutenant: {
      mu: 26.5, // +1.5 from 25.0 (was too close to Commander)
      sigma: 3.5,
      matches: 999,
    },
    commander: {
      mu: 35.0, // +3.0 from 32.0 (stronger separation needed)
      sigma: 3.0,
      matches: 999,
    },
  },
  goOut: {
    ensign: {
      mu: 17.5, // Weakest tier
      sigma: 4.5,
      matches: 999,
    },
    lieutenant: {
      mu: 28.0, // +2.0 from 26.0 (combat compression)
      sigma: 4.0,
      matches: 999,
    },
    commander: {
      mu: 41.5, // +7.5 from 34.0 (much wider gap needed for go-out)
      sigma: 3.5,
      matches: 999,
    },
  },
};

/**
 * Calibration status flag.
 * Set to true after Phase 1.3 calibration complete.
 * Updated 2026-07-12 with 500-game self-play calibration.
 */
export const ANCHORS_CALIBRATED = true;

/**
 * Module Zeta (Fleet Squadrons) team-rating calibration gate.
 *
 * When true, eligible online Zeta sectors write the dedicated `squadRating`
 * OpenSkill track (never FFA `humanRating`). Calibrated 2026-07-13 via
 * Commander/Lieutenant/Ensign 2v2 self-play (`openskill-squad-calibration.spec.ts`):
 * points Cmdr×2 vs Lt×2 ≈ 62% (parity with FFA ≈ 64%); vs Ensign ≈ 88%.
 * Luck/skill matrix already skill-promote (~2.94/4). Keep false only to
 * emergency-disable squad TEI writes without removing Module Zeta play.
 */
export const SQUADRONS_RATING_CALIBRATED = true;

/**
 * Get the calibrated AI anchor rating for a given track and skill level.
 */
export function getAIAnchor(
  track: RatingTrack,
  skillLevel: AiSkillLevel
): PlayerRating {
  return INITIAL_ANCHORS[track][skillLevel];
}
