import { describe, expect, it } from 'vitest';

import { buildWarpContext } from './context.js';
import type { WarpAiAction } from './actions.js';
import { DEFAULT_WARP_HEURISTICS, WARP_HEURISTIC_IDS } from './heuristics.js';
import {
  countChainPlaysFromOpenEnd,
  resolveGoOutRacePhase,
} from './go-out-race.js';
import type { WarpAiObservation } from './observation.js';
import { makeRound } from './test-fixtures.js';

const H = WARP_HEURISTIC_IDS;

describe('go-out race phase', () => {
  it('enters defensive when behind a leader near empty', () => {
    const obs: WarpAiObservation = {
      round: makeRound({
        hands: {
          a: [
            { low: 12, high: 11 },
            { low: 11, high: 9 },
            { low: 9, high: 5 },
            { low: 5, high: 3 },
          ],
          b: [{ low: 2, high: 0 }],
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

    expect(resolveGoOutRacePhase(obs, 4, buildWarpContext(obs, () => 0.5).goOutTuning)).toBe(
      'defensive'
    );
  });

  it('counts a full hand chain from an open end', () => {
    const chain = countChainPlaysFromOpenEnd(11, [
      { low: 11, high: 9 },
      { low: 9, high: 5 },
      { low: 5, high: 3 },
    ]);
    expect(chain).toBe(3);
  });
});

describe('goOutFeasibility heuristic', () => {
  it('rewards a move that clears the hand next turn', () => {
    const obs: WarpAiObservation = {
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

    const setupChart: WarpAiAction = {
      kind: 'chart',
      move: {
        coordinate: { low: 12, high: 11 },
        route: { kind: 'warp-trail', playerId: 'a' },
      },
    };

    const heuristic = DEFAULT_WARP_HEURISTICS.find(
      (entry) => entry.id === H.goOutFeasibility
    )!;
    const ctx = buildWarpContext(obs, () => 0.5);
    expect(heuristic.score(setupChart, ctx)).toBeGreaterThan(30);
  });
});
