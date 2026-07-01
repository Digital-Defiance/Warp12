import { describe, expect, it } from 'vitest';

import { makeRound, makeGame } from '../engine/test-helpers.js';
import { explainWarpAiAction } from './explain-action.js';
import type { WarpAiAction } from './actions.js';

describe('explainWarpAiAction', () => {
  it('explains shedding heavy pips on a chart move', () => {
    const round = makeRound(['a', 'b'], {
      roundNumber: 5,
      activePlayerId: 'a',
      spacedockValue: 6,
      hands: {
        a: [
          { low: 10, high: 12 },
          { low: 2, high: 3 },
        ],
        b: [{ low: 1, high: 1 }],
      },
      table: {
        spacedock: { value: 6, placedBy: 'a' },
        warpTrails: {
          a: {
            playerId: 'a',
            tiles: [
              {
                coordinate: { low: 6, high: 8 },
                index: 0,
                openValue: 8,
              },
            ],
            distressBeacon: { active: false },
          },
          b: {
            playerId: 'b',
            tiles: [],
            distressBeacon: { active: false },
          },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
      },
    });
    const state = makeGame(round, { objective: 'points' });
    const action: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: { low: 10, high: 12 },
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    };

    const reasons = explainWarpAiAction(state, 'a', action);
    expect(reasons.some((line) => line.includes('22 pip'))).toBe(true);
  });

  it('explains drawing when no chart is available', () => {
    const round = makeRound(['a'], {
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
    });
    const state = makeGame(round);
    const reasons = explainWarpAiAction(state, 'a', { kind: 'draw' });
    expect(reasons[0]).toContain('must draw');
  });

  it('explains a round-winning chart', () => {
    const state = makeGame(
      makeRound(['a'], {
        activePlayerId: 'a',
        spacedockValue: 5,
        hands: { a: [{ low: 5, high: 7 }] },
        table: {
          spacedock: { value: 5, placedBy: 'a' },
          warpTrails: {
            a: {
              playerId: 'a',
              tiles: [
                {
                  coordinate: { low: 5, high: 6 },
                  index: 0,
                  openValue: 6,
                },
              ],
              distressBeacon: { active: false },
            },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      }),
      { objective: 'go-out' }
    );

    const action: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: { low: 5, high: 7 },
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    };

    const reasons = explainWarpAiAction(state, 'a', action);
    expect(reasons.some((line) => line.includes('win the round'))).toBe(true);
  });

  it('explains All Stop when All Stop! echo is active', () => {
    const state = makeGame(
      makeRound(['a'], {
        activePlayerId: 'a',
        allStopRequired: true,
        roundWinnerId: 'a',
        qEffects: {
          reverseTurnOrder: false,
          temporalInversion: false,
          openAllTrails: false,
          suppressNextFracture: false,
          skipNextTurnFor: [],
          peekedSector: null,
          salamanderSwap: false,
          allStopEcho: true,
        },
      })
    );

    const reasons = explainWarpAiAction(state, 'a', { kind: 'all-stop' });
    expect(reasons[0]).toContain('Round win pending');
  });

  it('explains Drop to Impulse and catch actions', () => {
    const state = makeGame(makeRound(['a', 'b'], { activePlayerId: 'a' }));

    expect(
      explainWarpAiAction(state, 'a', { kind: 'drop-to-impulse' })[0]
    ).toContain('Drop to Impulse');

    expect(
      explainWarpAiAction(
        state,
        'b',
        { kind: 'catch-drop-to-impulse', targetPlayerId: 'a' },
        { names: { a: 'Alpha' } }
      )[0]
    ).toContain('Alpha');
  });
});
