/**
 * Tests for TEI Grade presentation layer.
 */

import { describe, it, expect } from 'vitest';
import {
  getTeiGrade,
  getTeiScore,
  getTeiDisplay,
  isTeiProvisional,
  getTeiGradeName,
  getTeiGradeDescription,
  previewTeiChange,
  DEFAULT_TEI_CONFIG,
  type PlayerRating,
} from './tei-grade.js';

describe('TEI Grade System', () => {
  describe('getTeiGrade', () => {
    it('assigns E grade for elite (σ < 0.5)', () => {
      expect(getTeiGrade(0.3, undefined)).toBe('E');
      expect(getTeiGrade(0.49, undefined)).toBe('E');
    });

    it('assigns V grade for veteran (0.5 ≤ σ < 1.5)', () => {
      expect(getTeiGrade(0.5, undefined)).toBe('V');
      expect(getTeiGrade(1.0, undefined)).toBe('V');
      expect(getTeiGrade(1.49, undefined)).toBe('V');
    });

    it('assigns C grade for consistent (1.5 ≤ σ < 2.5)', () => {
      expect(getTeiGrade(1.5, undefined)).toBe('C');
      expect(getTeiGrade(2.0, undefined)).toBe('C');
      expect(getTeiGrade(2.49, undefined)).toBe('C');
    });

    it('assigns I grade for improving (2.5 ≤ σ < 4.0)', () => {
      expect(getTeiGrade(2.5, undefined)).toBe('I');
      expect(getTeiGrade(3.0, undefined)).toBe('I');
      expect(getTeiGrade(3.99, undefined)).toBe('I');
    });

    it('assigns P grade for provisional (σ ≥ 4.0)', () => {
      expect(getTeiGrade(4.0, undefined)).toBe('P');
      expect(getTeiGrade(8.33, undefined)).toBe('P'); // Default starting σ
      expect(getTeiGrade(10.0, undefined)).toBe('P');
    });

    describe('unidirectional hysteresis', () => {
      it('promotes immediately when σ drops (V→E)', () => {
        // Player at V with σ = 1.0, then σ drops to 0.4
        expect(getTeiGrade(0.4, 'V')).toBe('E'); // Instant promotion!
        
        // Even σ = 0.49 promotes immediately
        expect(getTeiGrade(0.49, 'V')).toBe('E'); // No delay for promotions
      });

      it('promotes immediately when σ drops (C→V)', () => {
        // Player at C with σ = 2.0, then σ drops to 1.4
        expect(getTeiGrade(1.4, 'C')).toBe('V'); // Instant promotion!
        expect(getTeiGrade(1.49, 'C')).toBe('V'); // No delay for promotions
      });

      it('promotes immediately when σ drops (I→C)', () => {
        // Player at I with σ = 3.5, then σ drops to 2.4
        expect(getTeiGrade(2.4, 'I')).toBe('C'); // Instant promotion!
        expect(getTeiGrade(2.49, 'I')).toBe('C'); // No delay for promotions
      });

      it('promotes immediately when σ drops (P→I)', () => {
        // Player at P with σ = 5.0, then σ drops to 3.9
        expect(getTeiGrade(3.9, 'P')).toBe('I'); // Instant promotion!
        expect(getTeiGrade(3.99, 'P')).toBe('I'); // No delay for promotions
      });

      it('requires sustained increase for demotion (V→C)', () => {
        // Player at V with σ = 1.0
        expect(getTeiGrade(1.6, 'V')).toBe('V'); // σ = 1.6 stays V (below exit 1.7)
        expect(getTeiGrade(1.69, 'V')).toBe('V'); // Still below exit threshold
        expect(getTeiGrade(1.71, 'V')).toBe('C'); // Crosses exit threshold → demote
      });

      it('requires sustained increase for demotion (C→I)', () => {
        // Player at C with σ = 2.0
        expect(getTeiGrade(2.6, 'C')).toBe('C'); // σ = 2.6 stays C (below exit 2.7)
        expect(getTeiGrade(2.69, 'C')).toBe('C'); // Still below exit threshold
        expect(getTeiGrade(2.71, 'C')).toBe('I'); // Crosses exit threshold → demote
      });

      it('requires sustained increase for demotion (I→P)', () => {
        // Player at I with σ = 3.5
        expect(getTeiGrade(4.4, 'I')).toBe('I'); // σ = 4.4 stays I (below exit 4.5)
        expect(getTeiGrade(4.49, 'I')).toBe('I'); // Still below exit threshold
        expect(getTeiGrade(4.51, 'I')).toBe('P'); // Crosses exit threshold → demote
      });

      it('prevents V→C flickering with unidirectional hysteresis', () => {
        // Player at V with σ fluctuating around 1.5
        expect(getTeiGrade(1.6, 'V')).toBe('V'); // Stays V (demote needs 1.7+)
        expect(getTeiGrade(1.4, 'V')).toBe('V'); // Still V (already at V)
        
        // But if at C, promotes back immediately
        expect(getTeiGrade(1.4, 'C')).toBe('V'); // Instant promotion
      });

      it('prevents C→I flickering with unidirectional hysteresis', () => {
        // Player at C with σ fluctuating around 2.5
        expect(getTeiGrade(2.6, 'C')).toBe('C'); // Stays C (demote needs 2.7+)
        expect(getTeiGrade(2.4, 'C')).toBe('C'); // Still C (already at C)
        
        // But if at I, promotes back immediately
        expect(getTeiGrade(2.4, 'I')).toBe('C'); // Instant promotion
      });

      it('allows large σ spikes to cross multiple grades', () => {
        // Player at E experiments with new module, σ spikes from 0.3 to 3.5
        expect(getTeiGrade(3.5, 'E')).toBe('I'); // Crosses E→V→C→I immediately
        
        // Player at V, σ spikes to 4.6
        expect(getTeiGrade(4.6, 'V')).toBe('P'); // Crosses V→C→I→P
      });

      it('creates asymmetric buffer zones', () => {
        // V grade: promote at 1.5, demote at 1.7 → 0.2 buffer for demotions only
        expect(getTeiGrade(1.49, 'C')).toBe('V'); // Instant promotion
        expect(getTeiGrade(1.6, 'V')).toBe('V'); // Demotion delayed
        
        // C grade: promote at 2.5, demote at 2.7 → 0.2 buffer for demotions only
        expect(getTeiGrade(2.49, 'I')).toBe('C'); // Instant promotion
        expect(getTeiGrade(2.6, 'C')).toBe('C'); // Demotion delayed
      });

      it('treats undefined currentGrade as new player (immediate thresholds)', () => {
        // New player uses immediate thresholds: 0.5, 1.5, 2.5, 4.0
        expect(getTeiGrade(0.49, undefined)).toBe('E');
        expect(getTeiGrade(0.5, undefined)).toBe('V');
        expect(getTeiGrade(1.49, undefined)).toBe('V');
        expect(getTeiGrade(1.5, undefined)).toBe('C');
        expect(getTeiGrade(2.49, undefined)).toBe('C');
        expect(getTeiGrade(2.5, undefined)).toBe('I');
        expect(getTeiGrade(3.99, undefined)).toBe('I');
        expect(getTeiGrade(4.0, undefined)).toBe('P');
      });
    });
  });

  describe('getTeiScore', () => {
    it('calculates score from conservative estimate (μ - 3σ)', () => {
      const rating: PlayerRating = { mu: 25.0, sigma: 3.0, matches: 10 };
      // Conservative: 25 - 3*3 = 16
      // Normalized: (16 - 10) / (50 - 10) * 99 = 6/40 * 99 ≈ 15
      const score = getTeiScore(rating);
      expect(score).toBeGreaterThanOrEqual(14);
      expect(score).toBeLessThanOrEqual(16);
    });

    it('clamps score to 0-99 range', () => {
      const veryLow: PlayerRating = { mu: 5.0, sigma: 1.0, matches: 5 };
      expect(getTeiScore(veryLow)).toBeGreaterThanOrEqual(0);

      const veryHigh: PlayerRating = { mu: 60.0, sigma: 0.5, matches: 500 };
      expect(getTeiScore(veryHigh)).toBeLessThanOrEqual(99);
    });

    it('gives higher scores to higher μ with same σ', () => {
      const low: PlayerRating = { mu: 20.0, sigma: 2.0, matches: 20 };
      const high: PlayerRating = { mu: 35.0, sigma: 2.0, matches: 20 };

      expect(getTeiScore(high)).toBeGreaterThan(getTeiScore(low));
    });

    it('penalizes high σ in conservative estimate', () => {
      const confident: PlayerRating = { mu: 30.0, sigma: 1.0, matches: 100 };
      const uncertain: PlayerRating = { mu: 30.0, sigma: 5.0, matches: 5 };

      // Both have same μ, but uncertain has much higher σ
      // Conservative: 30 - 3*1 = 27 vs 30 - 3*5 = 15
      expect(getTeiScore(confident)).toBeGreaterThan(getTeiScore(uncertain));
    });
  });

  describe('getTeiDisplay', () => {
    it('combines grade and score into formatted string', () => {
      const rating: PlayerRating = { mu: 32.0, sigma: 1.2, matches: 150 };
      const display = getTeiDisplay(rating);

      expect(display.grade).toBe('V'); // σ = 1.2 → Veteran
      expect(display.score).toBeGreaterThanOrEqual(0);
      expect(display.score).toBeLessThanOrEqual(99);
      expect(display.formatted).toBe(`${display.grade}${display.score}`);
    });

    it('formats typical Commander rating', () => {
      // Commander anchor: μ=35, σ=3.0
      const commander: PlayerRating = { mu: 35.0, sigma: 3.0, matches: 999 };
      const display = getTeiDisplay(commander);

      expect(display.grade).toBe('I'); // σ = 3.0 → Improving
      // Conservative: 35 - 9 = 26
      // Normalized: (26-10)/(50-10)*99 = 16/40*99 ≈ 40
      expect(display.score).toBeGreaterThanOrEqual(38);
      expect(display.score).toBeLessThanOrEqual(42);
    });

    it('formats typical Lieutenant rating', () => {
      // Lieutenant anchor: μ=26.5, σ=3.5
      const lieutenant: PlayerRating = { mu: 26.5, sigma: 3.5, matches: 999 };
      const display = getTeiDisplay(lieutenant);

      expect(display.grade).toBe('I'); // σ = 3.5 → Improving
      // Conservative: 26.5 - 10.5 = 16
      expect(display.score).toBeGreaterThanOrEqual(14);
      expect(display.score).toBeLessThanOrEqual(16);
    });

    it('formats typical Ensign rating', () => {
      // Ensign anchor: μ=18, σ=4.0
      const ensign: PlayerRating = { mu: 18.0, sigma: 4.0, matches: 999 };
      const display = getTeiDisplay(ensign);

      expect(display.grade).toBe('P'); // σ = 4.0 → Provisional (at threshold)
      // Conservative: 18 - 12 = 6 (below min) → clamped to 0
      expect(display.score).toBe(0);
    });

    it('shows E grade for highly experienced player', () => {
      // Elite player: μ=40, σ=0.4 (500+ games, very stable)
      const elite: PlayerRating = { mu: 40.0, sigma: 0.4, matches: 500 };
      const display = getTeiDisplay(elite);

      expect(display.grade).toBe('E'); // σ = 0.4 → Elite
      // Conservative: 40 - 1.2 = 38.8
      // Normalized: (38.8-10)/(50-10)*99 ≈ 71
      expect(display.score).toBeGreaterThanOrEqual(70);
      expect(display.score).toBeLessThanOrEqual(73);
    });
  });

  describe('isTeiProvisional', () => {
    it('identifies provisional ratings (σ ≥ 4.0)', () => {
      const provisional: PlayerRating = { mu: 25.0, sigma: 4.0, matches: 0 };
      expect(isTeiProvisional(provisional)).toBe(true);

      const highlyProvisional: PlayerRating = { mu: 25.0, sigma: 8.33, matches: 0 };
      expect(isTeiProvisional(highlyProvisional)).toBe(true);
    });

    it('identifies non-provisional ratings (σ < 4.0)', () => {
      const improving: PlayerRating = { mu: 25.0, sigma: 3.5, matches: 10 };
      expect(isTeiProvisional(improving)).toBe(false);

      const veteran: PlayerRating = { mu: 30.0, sigma: 1.0, matches: 100 };
      expect(isTeiProvisional(veteran)).toBe(false);
    });
  });

  describe('getTeiGradeName and Description', () => {
    it('provides human-readable names', () => {
      expect(getTeiGradeName('E')).toBe('Elite');
      expect(getTeiGradeName('V')).toBe('Veteran');
      expect(getTeiGradeName('C')).toBe('Consistent');
      expect(getTeiGradeName('I')).toBe('Improving');
      expect(getTeiGradeName('P')).toBe('Provisional');
    });

    it('provides descriptions for tooltips', () => {
      const desc = getTeiGradeDescription('V');
      expect(desc).toContain('reliable');
      expect(desc.length).toBeGreaterThan(10);
    });
  });

  describe('previewTeiChange', () => {
    it('estimates TEI change on win', () => {
      const rating: PlayerRating = { mu: 25.0, sigma: 3.0, matches: 10 };
      const preview = previewTeiChange(rating, 'I', true);

      expect(preview.currentTei.grade).toBe('I'); // σ = 3.0
      expect(preview.estimatedTei.grade).toBe('I'); // σ still > 2.5 after one game
      expect(preview.scoreDelta).toBeGreaterThan(0); // Win increases score
    });

    it('estimates TEI change on loss', () => {
      const rating: PlayerRating = { mu: 30.0, sigma: 2.0, matches: 50 };
      const preview = previewTeiChange(rating, 'C', false);

      expect(preview.currentTei.grade).toBe('C'); // σ = 2.0
      expect(preview.scoreDelta).toBeLessThan(0); // Loss decreases score
    });

    it('detects grade boundary crossing with unidirectional hysteresis', () => {
      // Player at I with σ = 2.6 (just above C immediate threshold of 2.5)
      const rating: PlayerRating = { mu: 28.0, sigma: 2.6, matches: 15 };
      const preview = previewTeiChange(rating, 'I', true);

      expect(preview.currentTei.grade).toBe('I'); // σ = 2.6 → Improving (above C immediate 2.5)
      // After game: σ ≈ 2.47 → crosses C immediate threshold (2.5), instant promotion to C
      expect(preview.estimatedTei.grade).toBe('C');
      expect(preview.gradeChange).toBe(true); // Promotion!
    });

    it('detects grade crossing with unidirectional hysteresis', () => {
      // Player at I with σ = 2.5 (at C immediate threshold)
      const rating: PlayerRating = { mu: 28.0, sigma: 2.5, matches: 15 };
      const preview = previewTeiChange(rating, 'I', true);

      expect(preview.currentTei.grade).toBe('I');
      // After game: σ ≈ 2.375 → crosses C immediate threshold (2.5), instant promotion to C
      expect(preview.estimatedTei.grade).toBe('C');
      expect(preview.gradeChange).toBe(true);
    });

    it('uses unidirectional hysteresis in preview with current grade', () => {
      // Player at C with σ = 2.5 (at I immediate threshold)
      const rating: PlayerRating = { mu: 28.0, sigma: 2.5, matches: 50 };
      const preview = previewTeiChange(rating, 'C', true); // Pass current grade

      expect(preview.currentTei.grade).toBe('C'); // Already at C, no change
      // After win: σ ≈ 2.375 → still well below C exit threshold (2.7), stays C
      expect(preview.estimatedTei.grade).toBe('C');
    });
  });

  describe('progression tension mechanics', () => {
    it('shows how new module experimentation spikes σ', () => {
      // Player has E84 (elite, experienced)
      const established: PlayerRating = { mu: 45.0, sigma: 0.4, matches: 500 };
      const beforeTei = getTeiDisplay(established);
      expect(beforeTei.grade).toBe('E');
      expect(beforeTei.score).toBeGreaterThan(80); // μ=45, σ=0.4 → score ≈84

      // After trying new module, σ increases (system re-evaluating)
      const experimenting: PlayerRating = { mu: 45.0, sigma: 3.5, matches: 505 };
      const afterTei = getTeiDisplay(experimenting);
      expect(afterTei.grade).toBe('I'); // Dropped from E to I!
      // Score also drops due to σ penalty in conservative estimate
      expect(afterTei.score).toBeLessThan(beforeTei.score);
    });

    it('creates dual progression goals (number AND letter)', () => {
      // Player grinding from I to C
      const early: PlayerRating = { mu: 28.0, sigma: 3.8, matches: 8 };
      const earlyTei = getTeiDisplay(early);
      expect(earlyTei.grade).toBe('I');

      // After 20 more consistent games, σ drops
      const later: PlayerRating = { mu: 30.0, sigma: 2.3, matches: 28 };
      const laterTei = getTeiDisplay(later);
      expect(laterTei.grade).toBe('C'); // Upgraded!
      expect(laterTei.score).toBeGreaterThan(earlyTei.score); // Both improved
    });
  });

  describe('edge cases', () => {
    it('handles extreme σ values', () => {
      const extreme: PlayerRating = { mu: 25.0, sigma: 20.0, matches: 0 };
      const display = getTeiDisplay(extreme);
      expect(display.grade).toBe('P');
      expect(display.score).toBe(0); // Conservative estimate way below min
    });

    it('handles extreme μ values', () => {
      const superHigh: PlayerRating = { mu: 100.0, sigma: 1.0, matches: 1000 };
      const display = getTeiDisplay(superHigh);
      expect(display.score).toBe(99); // Clamped to max
    });

    it('handles zero matches (new player)', () => {
      const newPlayer: PlayerRating = { mu: 25.0, sigma: 8.33, matches: 0 };
      const display = getTeiDisplay(newPlayer);
      expect(display.grade).toBe('P');
      expect(display.score).toBeGreaterThanOrEqual(0);
    });
  });
});
