import { describe, expect, it } from 'vitest';
import { subspaceFractureAppliesToDouble } from './subspace-fracture-scope.js';
import { formSquadrons } from '../engine/squadrons.js';
import type { RoundState } from './game-state.js';

describe('subspaceFractureAppliesToDouble', () => {
  const ffaRound = {} as RoundState;

  describe('own-trail scope (FFA)', () => {
    it('applies when the double is on the acting captain\'s own trail', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'warp-trail', playerId: 'a' },
          'a',
          'own-trail',
          ffaRound
        )
      ).toBe(true);
    });

    it('does not apply on an opponent\'s trail', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'warp-trail', playerId: 'b' },
          'a',
          'own-trail',
          ffaRound
        )
      ).toBe(false);
    });

    it('does not apply on the Neutral Zone', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'neutral-zone' },
          'a',
          'own-trail',
          ffaRound
        )
      ).toBe(false);
    });
  });

  describe('own-trail scope (Module Zeta squads)', () => {
    const { squadrons } = formSquadrons(['a', 'b', 'c', 'd'], 2);
    const squadRound = { squadrons } as unknown as RoundState;

    it('applies when a squadmate charts a double on the SHARED squad trail (route.playerId is the trailKey, not the actor\'s own id)', () => {
      // c is squadmates with a (shared trail keyed 'a'). Before the fix this
      // compared route.playerId ('a') === playerId ('c') directly and always
      // returned false for a non-owner squadmate — the fracture would never
      // open for them on their own (shared) trail.
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'warp-trail', playerId: 'a' }, // squad-1's trailKey
          'c', // acting captain — squadmate, not the trailKey owner
          'own-trail',
          squadRound
        )
      ).toBe(true);
    });

    it('does not apply when charted on an opposing squad\'s trail', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'warp-trail', playerId: 'b' }, // squad-2's trailKey
          'c', // squad-1 member
          'own-trail',
          squadRound
        )
      ).toBe(false);
    });
  });

  describe('all-captains scope', () => {
    it('applies to any warp-trail route regardless of owner', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'warp-trail', playerId: 'b' },
          'a',
          'all-captains',
          ffaRound
        )
      ).toBe(true);
    });

    it('does not apply to the Neutral Zone', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'neutral-zone' },
          'a',
          'all-captains',
          ffaRound
        )
      ).toBe(false);
    });
  });

  describe('all-doubles scope', () => {
    it('applies to warp-trail and Neutral Zone routes', () => {
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'warp-trail', playerId: 'b' },
          'a',
          'all-doubles',
          ffaRound
        )
      ).toBe(true);
      expect(
        subspaceFractureAppliesToDouble(
          { kind: 'neutral-zone' },
          'a',
          'all-doubles',
          ffaRound
        )
      ).toBe(true);
    });
  });
});
