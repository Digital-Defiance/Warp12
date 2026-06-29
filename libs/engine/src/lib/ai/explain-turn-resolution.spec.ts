import { describe, expect, it } from 'vitest';

import { makeGame, makeRound } from '../engine/test-helpers.js';
import { explainTurnResolution } from './explain-turn-resolution.js';

describe('explainTurnResolution', () => {
  it('requires drawing before pass when the pile has tiles', () => {
    const state = makeGame(
      makeRound(['a'], {
        activePlayerId: 'a',
        hands: { a: [{ low: 1, high: 2 }] },
        unchartedSectors: [{ low: 3, high: 4 }],
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      })
    );

    expect(explainTurnResolution(state, 'a')[0]).toContain('must draw');
  });

  it('explains pass red alert after the pile is exhausted', () => {
    const state = makeGame(
      makeRound(['a', 'b'], {
        activePlayerId: 'a',
        hands: { a: [{ low: 1, high: 2 }], b: [] },
        unchartedSectors: [],
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: false },
            },
            b: {
              playerId: 'b',
              tiles: [
                {
                  coordinate: { low: 3, high: 3 },
                  index: 0,
                  openValue: 3,
                },
              ],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: {
            active: true,
            responsiblePlayerId: 'a',
            trailPlayerId: 'b',
            anchor: {
              coordinate: { low: 3, high: 3 },
              index: 0,
              openValue: 3,
            },
          },
        },
      })
    );

    const lines = explainTurnResolution(state, 'a', {
      names: { b: 'Riker' },
      focus: 'pass-red-alert',
    });
    expect(lines[0]).toContain('Pass Red Alert is legal');
    expect(lines.some((line) => line.includes("Riker's warp trail"))).toBe(true);
  });

  it('explains voluntary pass when shields are already down', () => {
    const state = makeGame(
      makeRound(['a'], {
        activePlayerId: 'a',
        hands: { a: [{ low: 1, high: 2 }] },
        unchartedSectors: [],
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [],
              distressBeacon: { active: true },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      })
    );

    expect(explainTurnResolution(state, 'a', { focus: 'pass-turn' })[0]).toContain(
      'Pass is legal'
    );
  });

  it('requires stabilizers while subspace fracture is active', () => {
    const anchor = {
      coordinate: { low: 9, high: 9 },
      index: 1,
      openValue: 9,
    };
    const state = makeGame(
      makeRound(['laforge'], {
        activePlayerId: 'laforge',
        hands: { laforge: [{ low: 4, high: 9 }] },
        table: {
          spacedock: { value: 12, placedBy: 'laforge' },
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [anchor],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [],
            requiredValue: 9,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'laforge',
            trailPlayerId: 'laforge',
          },
        },
      })
    );

    expect(explainTurnResolution(state, 'laforge')[0]).toContain(
      'third stabilizer clears the fracture and Red Alert'
    );
  });

  it('explains draw while fracture is active without a stabilizer in hand', () => {
    const anchor = {
      coordinate: { low: 9, high: 9 },
      index: 1,
      openValue: 9,
    };
    const state = makeGame(
      makeRound(['laforge'], {
        activePlayerId: 'laforge',
        hands: { laforge: [{ low: 0, high: 1 }] },
        unchartedSectors: [{ low: 2, high: 9 }],
        table: {
          spacedock: { value: 12, placedBy: 'laforge' },
          warpTrails: {
            laforge: {
              playerId: 'laforge',
              tiles: [anchor],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: {
            active: true,
            anchor,
            stabilizers: [
              {
                coordinate: { low: 4, high: 9 },
                index: 0,
                openValue: 4,
              },
            ],
            requiredValue: 9,
          },
          redAlert: {
            active: true,
            anchor,
            responsiblePlayerId: 'laforge',
            trailPlayerId: 'laforge',
          },
        },
      })
    );

    const lines = explainTurnResolution(state, 'laforge');
    expect(lines[0]).toContain('no stabilizer in your hand');
    expect(lines.some((line) => line.includes('separate cover tile is not used'))).toBe(
      true
    );
  });
});
