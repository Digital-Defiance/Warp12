import { describe, it, expect } from 'vitest';
import { normalizeCoordinate } from '../types/coordinate.js';
import { executeWarpDriveSpool, determineLongestTrailWinner, executeOverdriveTieBreak } from './warp-drive-spool.js';
import { DEFAULT_MODULES } from '../types/modules.js';
import type { RoundState } from '../types/game-state.js';

// executeWarpDriveSpool only reads round.squadrons (via trailKeyFor /
// routeIsOwnTrail) — an FFA round (squadrons omitted) is sufficient here.
const FFA_ROUND = {} as RoundState;

describe('Module Delta — Warp Drive Spooling', () => {
  describe('Basic Spool Mechanics', () => {
    it('spools successfully until mismatch', () => {
      const uncharted = [
        normalizeCoordinate(11, 9),  // matches 11 → endpoint 9
        normalizeCoordinate(9, 7),   // matches 9 → endpoint 7
        normalizeCoordinate(7, 5),   // matches 7 → endpoint 5
        normalizeCoordinate(5, 3),   // matches 5 → endpoint 3
        normalizeCoordinate(11, 8),  // MISMATCH (neither 11 nor 8 matches 3)
      ];

      const result = executeWarpDriveSpool(
        11, // starting endpoint
        uncharted,
        DEFAULT_MODULES,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );

      expect(result.success).toBe(false);
      expect(result.tilesPlayed).toHaveLength(4); // 11-9, 9-7, 7-5, 5-3
      expect(result.tilesSentToHand).toHaveLength(1); // 8-11 (mismatch)
      expect(result.finalEndpoint).toBe(3);
      expect(result.redAlertActive).toBe(false);
    });

    it('spools successfully through entire pile', () => {
      const uncharted = [
        normalizeCoordinate(11, 9),
        normalizeCoordinate(9, 7),
        normalizeCoordinate(7, 5),
      ];

      const result = executeWarpDriveSpool(
        11,
        uncharted,
        DEFAULT_MODULES,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );
      expect(result.tilesPlayed).toHaveLength(3);
      expect(result.tilesSentToHand).toHaveLength(0);
      expect(result.finalEndpoint).toBe(5);
    });

    it('handles immediate mismatch', () => {
      const uncharted = [
        normalizeCoordinate(11, 6), // doesn't match 9
      ];

      const result = executeWarpDriveSpool(
        9,
        uncharted,
        DEFAULT_MODULES,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );
      expect(result.tilesPlayed).toHaveLength(0);
      expect(result.tilesSentToHand).toHaveLength(1);
      expect(result.finalEndpoint).toBe(9);
    });
  });

  describe('Red Alert During Spool', () => {
    it('spools through a covered double successfully', () => {
      const uncharted = [
        normalizeCoordinate(11, 9),
        normalizeCoordinate(9, 9),  // DOUBLE - Red Alert
        normalizeCoordinate(9, 7),  // covers double → endpoint 7
        normalizeCoordinate(7, 5),  // continues → endpoint 5
        normalizeCoordinate(11, 2),  // MISMATCH (neither 11 nor 2 matches 5)
      ];

      const result = executeWarpDriveSpool(
        11,
        uncharted,
        DEFAULT_MODULES,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );

      expect(result.success).toBe(false);
      expect(result.tilesPlayed).toHaveLength(4); // 11-9, 9-9, 9-7, 7-5
      expect(result.tilesSentToHand).toHaveLength(1); // 2-11
      expect(result.redAlertActive).toBe(false);
      expect(result.abortedUnfinishedDouble).toBe(false);
    });

    it('retrieves uncovered double when cover mismatches (no Red Alert)', () => {
      const uncharted = [
        normalizeCoordinate(11, 9),
        normalizeCoordinate(9, 9),  // DOUBLE
        normalizeCoordinate(9, 3),  // covers → endpoint 3
        normalizeCoordinate(3, 3),  // ANOTHER DOUBLE
        normalizeCoordinate(11, 8),  // MISMATCH — fails to cover
      ];

      const result = executeWarpDriveSpool(
        11,
        uncharted,
        DEFAULT_MODULES,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );

      expect(result.success).toBe(false);
      // 11-9, 9-9, 9-3 charted; 3-3 retrieved with failed cover
      expect(result.tilesPlayed).toHaveLength(3);
      expect(result.tilesSentToHand).toHaveLength(2); // 3-3 + 8-11
      expect(result.redAlertActive).toBe(false);
      expect(result.abortedUnfinishedDouble).toBe(true);
      expect(result.finalEndpoint).toBe(3);
    });

    it('retrieves double when pile empties before cover (no Red Alert)', () => {
      const uncharted = [
        normalizeCoordinate(11, 9),
        normalizeCoordinate(9, 9),  // DOUBLE - no more tiles
      ];

      const result = executeWarpDriveSpool(
        11,
        uncharted,
        DEFAULT_MODULES,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );

      expect(result.success).toBe(false);
      expect(result.tilesPlayed).toHaveLength(1); // 11-9 only
      expect(result.tilesSentToHand).toHaveLength(1); // 9-9 retrieved
      expect(result.redAlertActive).toBe(false);
      expect(result.abortedUnfinishedDouble).toBe(true);
      expect(result.finalEndpoint).toBe(9);
    });
  });

  describe('Subspace Fracture During Spool', () => {
    it('spools through satisfied fracture', () => {
      const modules = {
        ...DEFAULT_MODULES,
        subspaceFracture: { enabled: true, scope: 'own-trail' as const },
      };

      const uncharted = [
        normalizeCoordinate(11, 9),
        normalizeCoordinate(9, 9),  // DOUBLE - Fracture opens
        normalizeCoordinate(9, 7),  // stabilizer 1
        normalizeCoordinate(9, 5),  // stabilizer 2
        normalizeCoordinate(9, 3),  // stabilizer 3 (center foot) → endpoint 3
        normalizeCoordinate(3, 1),  // continues from endpoint 3 → endpoint 1
        normalizeCoordinate(11, 8),  // MISMATCH (neither 11 nor 8 matches 1)
      ];

      const result = executeWarpDriveSpool(
        11,
        uncharted,
        modules,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );

      expect(result.success).toBe(false);
      expect(result.tilesPlayed).toHaveLength(6); // 11-9, 9-9, 9-7, 9-5, 9-3, 3-1
      expect(result.tilesSentToHand).toHaveLength(1); // 8-11
      expect(result.fractureActive).toBe(false);
      expect(result.redAlertActive).toBe(false);
      expect(result.abortedUnfinishedDouble).toBe(false);
    });

    it('retrieves double and failed stabilizer when Fracture cannot finish', () => {
      const modules = {
        ...DEFAULT_MODULES,
        subspaceFracture: { enabled: true, scope: 'own-trail' as const },
      };

      const uncharted = [
        normalizeCoordinate(11, 9),
        normalizeCoordinate(9, 9),  // DOUBLE - Fracture opens
        normalizeCoordinate(9, 7),  // stabilizer 1
        normalizeCoordinate(9, 5),  // stabilizer 2
        normalizeCoordinate(9, 2),  // stabilizer 3 → endpoint 2
        normalizeCoordinate(2, 2),  // ANOTHER FRACTURE
        normalizeCoordinate(2, 1),  // stabilizer 1
        normalizeCoordinate(2, 3),  // stabilizer 2
        normalizeCoordinate(11, 8),  // MISMATCH on 3rd stabilizer
      ];

      const result = executeWarpDriveSpool(
        11,
        uncharted,
        modules,
        { kind: 'warp-trail', playerId: 'a' },
        'a',
      FFA_ROUND
      );

      expect(result.success).toBe(false);
      // Through first fracture + continue 3-1… wait sequence:
      // 11-9, 9-9, three stabs, then 2-2 starts second fracture, 2-1, 2-3 charted,
      // then 11-8 fails → retrieve 2-2 + two stabs + failed 11-8
      expect(result.tilesPlayed).toHaveLength(5); // 11-9 + first fracture (9-9+3 stabs) = 5
      expect(result.tilesSentToHand).toHaveLength(4); // 2-2, 2-1, 2-3, 8-11
      expect(result.fractureActive).toBe(false);
      expect(result.redAlertActive).toBe(false);
      expect(result.abortedUnfinishedDouble).toBe(true);
      expect(result.finalEndpoint).toBe(2);
    });
  });

  describe('Longest Trail Winner', () => {
    it('determines clear winner', () => {
      const trails = {
        a: [
          { coordinate: normalizeCoordinate(12, 11) },
          { coordinate: normalizeCoordinate(11, 9) },
          { coordinate: normalizeCoordinate(9, 7) },
        ],
        b: [
          { coordinate: normalizeCoordinate(12, 10) },
          { coordinate: normalizeCoordinate(10, 8) },
        ],
      };

      const result = determineLongestTrailWinner(trails, null);

      expect(result.winner).toBe('a');
      expect(result.length).toBe(3);
      expect(result.tied).toHaveLength(0);
    });

    it('detects tie without hazard holder', () => {
      const trails = {
        a: [
          { coordinate: normalizeCoordinate(12, 11) },
          { coordinate: normalizeCoordinate(11, 9) },
          { coordinate: normalizeCoordinate(9, 7) },
        ],
        b: [
          { coordinate: normalizeCoordinate(12, 10) },
          { coordinate: normalizeCoordinate(10, 8) },
          { coordinate: normalizeCoordinate(8, 6) },
        ],
      };

      const result = determineLongestTrailWinner(trails, null);

      expect(result.winner).toBe(null);
      expect(result.length).toBe(3);
      expect(result.tied).toHaveLength(2);
      expect(result.tied).toContain('a');
      expect(result.tied).toContain('b');
    });

    it('breaks tie with hazard marker holder loses', () => {
      const trails = {
        a: [
          { coordinate: normalizeCoordinate(12, 11) },
          { coordinate: normalizeCoordinate(11, 9) },
          { coordinate: normalizeCoordinate(9, 7) },
        ],
        b: [
          { coordinate: normalizeCoordinate(12, 10) },
          { coordinate: normalizeCoordinate(10, 8) },
          { coordinate: normalizeCoordinate(8, 6) },
        ],
      };

      const result = determineLongestTrailWinner(trails, 'a'); // 'a' holds hazard

      expect(result.winner).toBe('b'); // 'a' loses due to hazard
      expect(result.length).toBe(3);
      expect(result.tied).toHaveLength(0);
    });
  });

  describe('Overdrive Tie-Break', () => {
    it('breaks tie with successful extensions', () => {
      const trails = {
        a: [
          { coordinate: normalizeCoordinate(12, 11) },
          { coordinate: normalizeCoordinate(11, 9) }, // { low: 9, high: 11 } - endpoint: 11
        ],
        b: [
          { coordinate: normalizeCoordinate(12, 10) },
          { coordinate: normalizeCoordinate(10, 8) }, // { low: 8, high: 10 } - endpoint: 10
        ],
      };

      const uncharted = [
        normalizeCoordinate(11, 7),  // 'a' extends (matches 11)
        normalizeCoordinate(10, 2),  // 'b' extends (matches 10)
      ];

      const result = executeOverdriveTieBreak(
        ['a', 'b'],
        trails,
        uncharted,
        ['a', 'b', 'c']
      );

      expect(result.winner).toBe(null); // Both extended by 1 - still tied
      expect(result.extensions['a']).toBe(1);
      expect(result.extensions['b']).toBe(1);
    });

    it('handles continuing tie after overdrive', () => {
      const trails = {
        a: [
          { coordinate: normalizeCoordinate(12, 11) },
          { coordinate: normalizeCoordinate(11, 9) }, // { low: 9, high: 11 } - endpoint: 11
        ],
        b: [
          { coordinate: normalizeCoordinate(12, 10) },
          { coordinate: normalizeCoordinate(10, 11) }, // { low: 10, high: 11 } - same endpoint 11!
        ],
      };

      const uncharted = [
        normalizeCoordinate(11, 7),  // 'a' extends (matches 11)
        normalizeCoordinate(7, 5),   // 'a' continues (matches 7 from previous)
        normalizeCoordinate(5, 4),   // MISMATCH for 'a' (doesn't match 5 from previous... wait)
      ];

      const result = executeOverdriveTieBreak(
        ['a', 'b'],
        trails,
        uncharted,
        ['a', 'b']
      );

      expect(result.winner).toBe('a'); // 'a' extends by 3, 'b' can't draw any
      expect(result.extensions['a']).toBe(3);
      expect(result.extensions['b']).toBe(0);
    });

    it('handles empty uncharted during overdrive', () => {
      const trails = {
        a: [{ coordinate: normalizeCoordinate(12, 11) }],
        b: [{ coordinate: normalizeCoordinate(12, 10) }],
      };

      const result = executeOverdriveTieBreak(
        ['a', 'b'],
        trails,
        [], // empty
        ['a', 'b']
      );

      expect(result.winner).toBe(null); // Neither extended
      expect(result.extensions['a']).toBe(0);
      expect(result.extensions['b']).toBe(0);
    });
  });
});
