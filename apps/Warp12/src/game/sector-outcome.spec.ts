import { describe, expect, it } from 'vitest';

import type { GameState } from 'warp12-engine';

import {
  sectorCompleteHeadline,
  sectorStandings,
  sectorWinnerId,
} from './sector-outcome.js';

function completeGame(over: Partial<GameState>): GameState {
  return {
    id: 'test',
    phase: 'complete',
    objective: 'penalty',
    campaignRounds: 3,
    completedRounds: 3,
    captains: [
      { id: 'you', displayName: 'You', penaltyScore: 42 },
      { id: 'ai', displayName: 'AI', penaltyScore: 18 },
    ],
    modules: {
      qContinuum: { enabled: false },
      salamanderPenalty: { enabled: false },
      subspaceFracture: { enabled: false, scope: 'own-trail' },
    },
    houseRules: {
      requireOwnTrailFirst: false,
      neutralZoneAfterAllTrails: false,
      beaconClearsOnAnyPlay: false,
      roundStarterPlaysTwo: false,
      dropToImpulseCall: false,
    },
    round: {
      roundNumber: 3,
      spacedockValue: 12,
      phase: 'ended',
      activePlayerId: 'ai',
      turnOrder: ['you', 'ai'],
      table: {
        spacedock: { value: 12, placedBy: 'you' },
        warpTrails: {
          you: { playerId: 'you', tiles: [], distressBeacon: { active: false } },
          ai: { playerId: 'ai', tiles: [], distressBeacon: { active: false } },
        },
        neutralZone: { tiles: [] },
        subspaceFracture: null,
        redAlert: null,
      },
      unchartedSectors: [],
      hands: { you: [], ai: [] },
      allStopRequired: false,
      allStopDeclared: false,
      roundWinnerId: 'ai',
      qPendingInvoker: null,
      qEffects: null,
      qGamblePending: null,
      mandatoryPlay: null,
      pendingRoundWin: null,
      roundBlocked: false,
      roundStarterOpening: null,
      dropToImpulseCallPending: null,
      dropToImpulseCatchable: null,
    },
    ...over,
  };
}

describe('sector outcome', () => {
  it('picks go-out sector winner from round winner', () => {
    const game = completeGame({
      objective: 'go-out',
      round: {
        ...completeGame({}).round!,
        roundWinnerId: 'you',
        hands: { you: [], ai: [{ low: 1, high: 2 }] },
      },
    });
    expect(sectorWinnerId(game)).toBe('you');
  });

  it('picks penalty campaign winner by lowest total', () => {
    const game = completeGame({});
    expect(sectorWinnerId(game)).toBe('ai');
    expect(sectorStandings(game, { you: 'You', ai: 'AI' })[0]?.id).toBe('ai');
  });

  it('writes a human-friendly campaign headline', () => {
    const game = completeGame({
      objective: 'go-out',
      campaignRounds: 1,
      round: {
        ...completeGame({}).round!,
        roundWinnerId: 'you',
        hands: { you: [], ai: [{ low: 1, high: 2 }] },
      },
    });
    expect(sectorCompleteHeadline(game, { you: 'You', ai: 'AI' }, 'you')).toContain(
      'You'
    );
  });
});
