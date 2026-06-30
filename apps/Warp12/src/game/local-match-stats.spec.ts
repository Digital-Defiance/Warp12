import type { GameState } from 'warp12-engine';
import { describe, expect, it } from 'vitest';

import {
  classifyLocalAiMatchSkill,
  humanWonLocalMatch,
} from './local-match-stats.js';

describe('classifyLocalAiMatchSkill', () => {
  it('uses the highest AI skill at the table', () => {
    expect(
      classifyLocalAiMatchSkill([
        { id: 'a', displayName: 'A', skill: 'ensign' },
        { id: 'b', displayName: 'B', skill: 'commander' },
      ])
    ).toBe('commander');
  });
});

function completedGame(partial: Partial<GameState> & Pick<GameState, 'objective' | 'captains'>): GameState {
  return {
    id: 'local-test',
    phase: 'complete',
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
    campaignRounds: 13,
    completedRounds: 1,
    round: null,
    ...partial,
  } as GameState;
}

describe('humanWonLocalMatch', () => {
  it('detects a go-out win for the human', () => {
    const game = completedGame({
      objective: 'go-out',
      captains: [
        { id: 'you', displayName: 'You', penaltyScore: 0 },
        { id: 'ai', displayName: 'Riker', penaltyScore: 0 },
      ],
      round: {
        roundWinnerId: 'you',
      } as GameState['round'],
    });

    expect(humanWonLocalMatch(game, 'you')).toBe(true);
    expect(humanWonLocalMatch(game, 'ai')).toBe(false);
  });

  it('detects a penalty campaign win by lowest score', () => {
    const game = completedGame({
      objective: 'penalty',
      captains: [
        { id: 'you', displayName: 'You', penaltyScore: 12 },
        { id: 'ai', displayName: 'Data', penaltyScore: 24 },
      ],
    });

    expect(humanWonLocalMatch(game, 'you')).toBe(true);
    expect(humanWonLocalMatch(game, 'ai')).toBe(false);
  });
});
