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
    objective: 'points',
    campaignRounds: 3,
    completedRounds: 3,
    captains: [
      { id: 'you', displayName: 'You', pointsScore: 42 },
      { id: 'ai', displayName: 'AI', pointsScore: 18 },
    ],
    modules: {
      continuum: { enabled: false, activeFlash: null },
      salamanderPenalty: { enabled: false },
      subspaceFracture: { enabled: false, scope: 'own-trail' },
    },
    houseRules: {
      requireOwnTrailFirst: false,
      neutralZoneAfterAllTrails: false,
      beaconClearsOnAnyPlay: false,
      roundStarterPlaysTwo: false,
      dropToImpulseCall: false,
      allStopCeremony: false,
      dropToImpulseCatchPenalty: 1,
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
      continuumPendingInvoker: null,
      continuumEffects: null,
      continuumWagerPending: null,
      mandatoryPlay: null,
      pendingRoundWin: null,
      roundBlocked: false,
      roundStarterOpening: null,
      roundStarterOpeningResolved: false,
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

  it('picks points campaign winner by lowest total', () => {
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

  it('ranks fixed-rounds go-out campaigns by goOutWins', () => {
    const game = completeGame({
      objective: 'go-out',
      goOutStructure: 'fixed-rounds',
      campaignRounds: 5,
      captains: [
        { id: 'you', displayName: 'You', pointsScore: 0, goOutWins: 2 },
        { id: 'ai', displayName: 'AI', pointsScore: 0, goOutWins: 3 },
      ],
    });
    expect(sectorWinnerId(game)).toBe('ai');
    const standings = sectorStandings(game, { you: 'You', ai: 'AI' });
    expect(standings[0]?.id).toBe('ai');
    expect(standings[0]?.label).toContain('Winner');
    expect(standings[0]?.value).toBe(3);
    expect(sectorCompleteHeadline(game, { you: 'You', ai: 'AI' }, 'you')).toContain(
      'AI wins the 5-round campaign'
    );
  });

  it('returns null winner when go-out campaign ends tied', () => {
    const game = completeGame({
      objective: 'go-out',
      goOutStructure: 'fixed-rounds',
      goOutOvertimePending: false,
      captains: [
        { id: 'you', displayName: 'You', pointsScore: 0, goOutWins: 2 },
        { id: 'ai', displayName: 'AI', pointsScore: 0, goOutWins: 2 },
      ],
    });
    expect(sectorWinnerId(game)).toBeNull();
    expect(sectorCompleteHeadline(game, { you: 'You', ai: 'AI' })).toContain(
      'tied'
    );
  });

  it('headlines first-to campaigns by win count', () => {
    const game = completeGame({
      objective: 'go-out',
      goOutStructure: 'first-to',
      goOutWinsToWin: 3,
      captains: [
        { id: 'you', displayName: 'You', pointsScore: 0, goOutWins: 3 },
        { id: 'ai', displayName: 'AI', pointsScore: 0, goOutWins: 1 },
      ],
    });
    expect(sectorWinnerId(game)).toBe('you');
    expect(sectorCompleteHeadline(game, { you: 'You', ai: 'AI' }, 'you')).toContain(
      'You reach 3 wins first'
    );
  });
});
