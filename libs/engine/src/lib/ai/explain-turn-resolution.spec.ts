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
});
