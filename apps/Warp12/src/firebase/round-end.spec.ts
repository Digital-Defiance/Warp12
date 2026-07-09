import { applyAction, resolveHouseRules, type GameState } from 'warp12-engine';
import { describe, expect, it } from 'vitest';

import { shouldRedealHandsAfterScore } from './round-end-hands.js';

function tile(low: number, high: number) {
  return { low, high };
}

describe('online round end scoring', () => {
  it('END_ROUND tallies pip points from every hand, not just the winner', () => {
    const state: GameState = {
      id: 'test',
      phase: 'active',
      objective: 'points',
      campaignRounds: 13,
      completedRounds: 12,
      captains: [
        { id: 'a', displayName: 'Alpha', pointsScore: 0 },
        { id: 'b', displayName: 'Beta', pointsScore: 0 },
      ],
      modules: {
        continuum: { enabled: false, activeFlash: null },
        salamanderPenalty: { enabled: false },
        subspaceFracture: { enabled: true, scope: 'own-trail' },
      },
      houseRules: resolveHouseRules(),
      round: {
        roundNumber: 13,
        spacedockValue: 12,
        phase: 'ended',
        activePlayerId: 'a',
        turnOrder: ['a', 'b'],
        hands: {
          a: [],
          b: [tile(6, 6), tile(3, 4)],
        },
        unchartedSectors: [],
        allStopRequired: false,
        allStopDeclared: true,
        roundWinnerId: 'a',
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
            b: { playerId: 'b', tiles: [], distressBeacon: { active: false } },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      },
    };

    const partialHands: GameState = {
      ...state,
      round: state.round
        ? {
            ...state.round,
            hands: {
              a: [],
              b: [],
            },
          }
        : null,
    };

    const wrong = applyAction(partialHands, { type: 'END_ROUND', winnerId: 'a' });
    const right = applyAction(state, { type: 'END_ROUND', winnerId: 'a' });

    expect(wrong.ok && right.ok).toBe(true);
    if (!wrong.ok || !right.ok) {
      return;
    }

    expect(wrong.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(0);
    expect(right.state.captains.find((c) => c.id === 'b')?.pointsScore).toBe(
      6 + 6 + 3 + 4
    );
    expect(shouldRedealHandsAfterScore(right.state.phase)).toBe(false);
    expect(right.state.phase).toBe('complete');
  });

  it('go-out END_ROUND completes without redealing', () => {
    const state: GameState = {
      id: 'test',
      phase: 'active',
      objective: 'go-out',
      campaignRounds: 13,
      completedRounds: 0,
      captains: [{ id: 'a', displayName: 'Alpha', pointsScore: 0 }],
      modules: {
        continuum: { enabled: false, activeFlash: null },
        salamanderPenalty: { enabled: true },
        subspaceFracture: { enabled: true, scope: 'own-trail' },
      },
      houseRules: resolveHouseRules(),
      round: {
        roundNumber: 1,
        spacedockValue: 12,
        phase: 'ended',
        activePlayerId: 'a',
        turnOrder: ['a'],
        hands: { a: [] },
        unchartedSectors: [],
        allStopRequired: false,
        allStopDeclared: true,
        roundWinnerId: 'a',
        continuumPendingInvoker: null,
        continuumEffects: null,
        continuumWagerPending: null,
        mandatoryPlay: null,
        pendingRoundWin: null,
        roundBlocked: false,
        roundStarterOpening: null,
        table: {
          spacedock: { value: 12, placedBy: 'a' },
          warpTrails: {
            a: { playerId: 'a', tiles: [], distressBeacon: { active: false } },
          },
          neutralZone: { tiles: [] },
          subspaceFracture: null,
          redAlert: null,
        },
      },
    };

    const result = applyAction(state, { type: 'END_ROUND', winnerId: 'a' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.phase).toBe('complete');
    expect(shouldRedealHandsAfterScore(result.state.phase)).toBe(false);
  });
});
