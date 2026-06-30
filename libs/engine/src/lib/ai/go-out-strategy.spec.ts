import { describe, expect, it } from 'vitest';

import type { WarpAiAction } from './actions.js';
import { buildWarpContext } from './context.js';
import { DEFAULT_WARP_HEURISTICS, WARP_HEURISTIC_IDS } from './heuristics.js';
import type { WarpAiObservation } from './observation.js';
import { makeRound, tableWithNeutralOpen, tableWithOwnTrail } from './test-fixtures.js';

const H = WARP_HEURISTIC_IDS;

function scoreHeuristic(
  id: string,
  action: WarpAiAction,
  obs: WarpAiObservation
): number {
  const ctx = buildWarpContext(obs, () => 0.5);
  const heuristic = DEFAULT_WARP_HEURISTICS.find((entry) => entry.id === id);
  if (!heuristic) {
    throw new Error(`missing heuristic ${id}`);
  }
  return heuristic.score(action, ctx);
}

describe('go-out trail strategy heuristics', () => {
  const obs: WarpAiObservation = {
    round: makeRound({
      hands: {
        a: [
          { low: 12, high: 11 },
          { low: 11, high: 9 },
          { low: 9, high: 5 },
          { low: 5, high: 3 },
          { low: 3, high: 1 },
        ],
        b: [
          { low: 6, high: 6 },
          { low: 8, high: 7 },
          { low: 7, high: 4 },
          { low: 4, high: 2 },
          { low: 2, high: 0 },
          { low: 10, high: 8 },
        ],
      },
    }),
    playerId: 'a',
    modules: {
      salamanderPenalty: { enabled: false },
      qContinuum: { enabled: false },
      subspaceFracture: { enabled: false },
    },
    houseRules: { dropToImpulseCall: false },
    objective: 'go-out',
    campaignRounds: 13,
    captains: [
      { id: 'a', displayName: 'A', penaltyScore: 0 },
      { id: 'b', displayName: 'B', penaltyScore: 0 },
    ],
  };

  const ownTrailChart: WarpAiAction = {
    kind: 'chart',
    move: {
      coordinate: { low: 12, high: 11 },
      route: { kind: 'warp-trail', playerId: 'a' },
    },
  };

  const sharedDouble: WarpAiAction = {
    kind: 'chart',
    move: {
      coordinate: { low: 6, high: 6 },
      route: { kind: 'neutral-zone' },
    },
  };

  it('prefers building on the own trail while the hand is still long', () => {
    expect(
      scoreHeuristic(H.goOutTrailPriority, ownTrailChart, obs)
    ).toBeGreaterThan(0);
    expect(
      scoreHeuristic(H.goOutTrailPriority, ownTrailChart, obs)
    ).toBeGreaterThan(scoreHeuristic(H.goOutTrailPriority, sharedDouble, obs));
  });

  it('penalizes mayhem doubles on shared routes with a full hand', () => {
    expect(scoreHeuristic(H.goOutAvoidMayhem, sharedDouble, obs)).toBeLessThan(0);
  });

  it('goOutBlockLeader penalizes easy shared ends when a rival is near out', () => {
    const nearOutObs: WarpAiObservation = {
      ...obs,
      round: makeRound({
        hands: {
          a: [
            { low: 12, high: 11 },
            { low: 11, high: 9 },
            { low: 9, high: 5 },
          ],
          b: [{ low: 2, high: 0 }],
        },
        table: tableWithNeutralOpen(9),
      }),
    };
    const sharedChart: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: { low: 9, high: 5 },
        route: { kind: 'neutral-zone' },
      },
    };
    expect(
      scoreHeuristic(H.goOutBlockLeader, sharedChart, nearOutObs)
    ).toBeLessThan(0);
  });

  it('goOutDrawReluctance penalizes drawing with charts available', () => {
    const drawObs: WarpAiObservation = {
      ...obs,
      round: makeRound({
        hands: {
          a: [
            { low: 12, high: 11 },
            { low: 11, high: 9 },
          ],
          b: [
            { low: 6, high: 6 },
            { low: 8, high: 7 },
            { low: 7, high: 4 },
            { low: 4, high: 2 },
            { low: 2, high: 0 },
            { low: 10, high: 8 },
          ],
        },
        table: tableWithOwnTrail('a', { low: 12, high: 11 }, 11),
      }),
    };
    expect(
      scoreHeuristic(H.goOutDrawReluctance, { kind: 'draw' }, drawObs)
    ).toBeLessThan(0);
  });

  it('goOutNeutralZoneDump favors NZ dumps in dump phase with a short hand', () => {
    const dumpObs: WarpAiObservation = {
      ...obs,
      round: makeRound({
        hands: {
          a: [
            { low: 3, high: 1 },
            { low: 2, high: 0 },
          ],
          b: [
            { low: 6, high: 6 },
            { low: 8, high: 7 },
            { low: 7, high: 4 },
            { low: 4, high: 2 },
            { low: 10, high: 8 },
          ],
        },
        table: tableWithOwnTrail('a', { low: 12, high: 11 }, 11),
      }),
    };
    const nzDump: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: { low: 3, high: 1 },
        route: { kind: 'neutral-zone' },
      },
    };
    expect(
      scoreHeuristic(H.goOutNeutralZoneDump, nzDump, dumpObs)
    ).toBeGreaterThan(0);
  });
});
