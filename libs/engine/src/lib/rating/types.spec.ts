import { describe, it, expect } from 'vitest';
import {
  DEFAULT_RATING,
  displayRating,
  ordinalRating,
  isProvisional,
  formatDisplayRating,
  formatFullRating,
  PROVISIONAL_SIGMA_THRESHOLD,
} from './types.js';

describe('rating types', () => {
  describe('DEFAULT_RATING', () => {
    it('has μ = 25.0, σ = 8.33, matches = 0', () => {
      expect(DEFAULT_RATING.mu).toBe(25.0);
      expect(DEFAULT_RATING.sigma).toBeCloseTo(8.33, 1);
      expect(DEFAULT_RATING.matches).toBe(0);
    });
  });

  describe('displayRating', () => {
    it('returns μ - 3σ (conservative estimate)', () => {
      const rating = { mu: 25.0, sigma: 8.33, matches: 0 };
      const display = displayRating(rating);
      expect(display).toBeCloseTo(0.0, 1); // 25 - 3*8.33 ≈ 0
    });

    it('returns 0 when μ - 3σ is negative', () => {
      const rating = { mu: 20.0, sigma: 10.0, matches: 0 };
      const display = displayRating(rating);
      expect(display).toBe(0); // max(0, 20 - 30) = 0
    });

    it('increases as σ decreases (confidence improves)', () => {
      const newPlayer = { mu: 27.5, sigma: 6.2, matches: 10 };
      const veteran = { mu: 27.5, sigma: 2.5, matches: 100 };

      expect(displayRating(newPlayer)).toBeCloseTo(8.9, 1);
      expect(displayRating(veteran)).toBeCloseTo(20.0, 1);
    });
  });

  describe('ordinalRating', () => {
    it('returns μ - σ (matchmaking bound)', () => {
      const rating = { mu: 30.0, sigma: 5.0, matches: 20 };
      expect(ordinalRating(rating)).toBe(25.0);
    });

    it('is higher than displayRating (less conservative)', () => {
      const rating = { mu: 30.0, sigma: 5.0, matches: 20 };
      expect(ordinalRating(rating)).toBeGreaterThan(displayRating(rating));
    });
  });

  describe('isProvisional', () => {
    it('returns true when σ > 6.0', () => {
      const rating = { mu: 25.0, sigma: 7.0, matches: 5 };
      expect(isProvisional(rating)).toBe(true);
    });

    it('returns false when σ ≤ 6.0', () => {
      const rating = { mu: 30.0, sigma: 5.0, matches: 15 };
      expect(isProvisional(rating)).toBe(false);
    });

    it('uses PROVISIONAL_SIGMA_THRESHOLD', () => {
      expect(PROVISIONAL_SIGMA_THRESHOLD).toBe(6.0);
    });
  });

  describe('formatDisplayRating', () => {
    it('formats display rating to 1 decimal place', () => {
      const rating = { mu: 32.1, sigma: 4.1, matches: 50 };
      expect(formatDisplayRating(rating)).toBe('19.8');
    });
  });

  describe('formatFullRating', () => {
    it('formats as "μ ± 3σ"', () => {
      const rating = { mu: 32.1, sigma: 4.1, matches: 50 };
      const formatted = formatFullRating(rating);
      expect(formatted).toMatch(/32\.1 ± 12\.3/);
    });
  });
});
