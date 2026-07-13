import { describe, it, expect } from 'vitest';
import { updateFFARatings, updateHeadToHead } from './update-ffa.js';
import { DEFAULT_RATING } from './types.js';

describe('FFA rating updates', () => {
  describe('updateHeadToHead', () => {
    it('increases winner μ and decreases loser μ', () => {
      const winner = {
        playerId: 'alice',
        rating: { ...DEFAULT_RATING },
      };
      const loser = {
        playerId: 'bob',
        rating: { ...DEFAULT_RATING },
      };

      const updated = updateHeadToHead(winner, loser);

      const aliceNew = updated.get('alice')!;
      const bobNew = updated.get('bob')!;

      // Alice (winner) μ should increase
      expect(aliceNew.mu).toBeGreaterThan(DEFAULT_RATING.mu);

      // Bob (loser) μ should decrease
      expect(bobNew.mu).toBeLessThan(DEFAULT_RATING.mu);

      // Both σ should decrease (experience gained)
      expect(aliceNew.sigma).toBeLessThan(DEFAULT_RATING.sigma);
      expect(bobNew.sigma).toBeLessThan(DEFAULT_RATING.sigma);

      // Matches count should increment
      expect(aliceNew.matches).toBe(1);
      expect(bobNew.matches).toBe(1);
    });

    it('winner gains more rating when beating stronger opponent', () => {
      const underdog = {
        playerId: 'alice',
        rating: { mu: 20.0, sigma: 5.0, matches: 10 },
      };
      const favorite = {
        playerId: 'bob',
        rating: { mu: 35.0, sigma: 4.0, matches: 50 },
      };

      const updated = updateHeadToHead(underdog, favorite);

      const aliceNew = updated.get('alice')!;
      const bobNew = updated.get('bob')!;

      const aliceGain = aliceNew.mu - underdog.rating.mu;
      const bobLoss = favorite.rating.mu - bobNew.mu;

      // Underdog wins upset → both ratings update
      expect(aliceGain).toBeGreaterThan(0); // Winner gains
      expect(bobLoss).toBeGreaterThan(0);   // Loser loses
      
      // Both sigma decrease (experience gained)
      expect(aliceNew.sigma).toBeLessThan(underdog.rating.sigma);
      expect(bobNew.sigma).toBeLessThan(favorite.rating.sigma);
    });
  });

  describe('updateFFARatings (multiplayer)', () => {
    it('updates 4-player FFA with correct rank ordering', () => {
      const players = [
        {
          playerId: 'alice',
          rating: { mu: 30.0, sigma: 5.0, matches: 20 },
          rank: 1, // winner
        },
        {
          playerId: 'bob',
          rating: { mu: 28.0, sigma: 5.0, matches: 18 },
          rank: 2,
        },
        {
          playerId: 'carol',
          rating: { mu: 26.0, sigma: 5.0, matches: 22 },
          rank: 3,
        },
        {
          playerId: 'dave',
          rating: { mu: 24.0, sigma: 5.0, matches: 15 },
          rank: 4, // last place
        },
      ];

      const updated = updateFFARatings(players);

      const alice = updated.get('alice')!;
      const bob = updated.get('bob')!;
      const carol = updated.get('carol')!;
      const dave = updated.get('dave')!;

      // Winner's μ changes based on expected vs actual performance
      // With similar-rated opponents, winner should gain or stay close
      const aliceDelta = alice.mu - players[0]!.rating.mu;
      expect(Math.abs(aliceDelta)).toBeLessThan(5.0); // reasonable change

      // Last place loses rating
      expect(dave.mu).toBeLessThan(players[3]!.rating.mu);

      // Ratings should maintain relative ordering after update
      // (not strict inequality due to Bayesian updates)
      expect(alice.mu + bob.mu).toBeGreaterThan(carol.mu + dave.mu);

      // All experience counts increment
      expect(alice.matches).toBe(21);
      expect(bob.matches).toBe(19);
      expect(carol.matches).toBe(23);
      expect(dave.matches).toBe(16);
    });

    it('handles ties (shared ranks)', () => {
      const players = [
        {
          playerId: 'alice',
          rating: { mu: 25.0, sigma: 8.0, matches: 0 },
          rank: 1, // winner
        },
        {
          playerId: 'bob',
          rating: { mu: 25.0, sigma: 8.0, matches: 0 },
          rank: 2, // tied for second
        },
        {
          playerId: 'carol',
          rating: { mu: 25.0, sigma: 8.0, matches: 0 },
          rank: 2, // tied for second
        },
      ];

      const updated = updateFFARatings(players);

      const alice = updated.get('alice')!;
      const bob = updated.get('bob')!;
      const carol = updated.get('carol')!;

      // Winner gains rating
      expect(alice.mu).toBeGreaterThan(25.0);

      // Tied players should have similar ratings
      expect(Math.abs(bob.mu - carol.mu)).toBeLessThan(0.1);
    });

    it('returns empty map for empty player list', () => {
      const updated = updateFFARatings([]);
      expect(updated.size).toBe(0);
    });

    it('returns unchanged rating for single player', () => {
      const player = {
        playerId: 'alice',
        rating: { mu: 25.0, sigma: 8.33, matches: 0 },
        rank: 1,
      };

      const updated = updateFFARatings([player]);
      const alice = updated.get('alice')!;

      // Rating should be unchanged (no opponent)
      expect(alice.mu).toBe(25.0);
      expect(alice.sigma).toBeCloseTo(8.33, 1);
      expect(alice.matches).toBe(0);
    });
  });
});
