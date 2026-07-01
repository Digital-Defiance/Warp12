import type { GameState } from 'warp12-engine';
import { describe, expect, it } from 'vitest';

import {
  classifyLocalAiMatchOpponent,
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

describe('classifyLocalAiMatchOpponent', () => {
  it('marks Class I* when all top-tier officers use search tier', () => {
    expect(
      classifyLocalAiMatchOpponent([
        { id: 'a', displayName: 'Riker', skill: 'commander', class1Star: true },
        { id: 'b', displayName: 'Troi', skill: 'commander', class1Star: true },
      ])
    ).toEqual({ skill: 'commander', opponentClass1Star: true });
  });

  it('does not mark Class I* for standard Class II officers', () => {
    expect(
      classifyLocalAiMatchOpponent([
        { id: 'a', displayName: 'Riker', skill: 'commander' },
      ])
    ).toEqual({ skill: 'commander', opponentClass1Star: false });
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
        { id: 'you', displayName: 'You', pointsScore: 0 },
        { id: 'ai', displayName: 'Riker', pointsScore: 0 },
      ],
      round: {
        roundWinnerId: 'you',
      } as GameState['round'],
    });

    expect(humanWonLocalMatch(game, 'you')).toBe(true);
    expect(humanWonLocalMatch(game, 'ai')).toBe(false);
  });

  it('detects a points campaign win by lowest score', () => {
    const game = completedGame({
      objective: 'points',
      captains: [
        { id: 'you', displayName: 'You', pointsScore: 12 },
        { id: 'ai', displayName: 'Data', pointsScore: 24 },
      ],
    });

    expect(humanWonLocalMatch(game, 'you')).toBe(true);
    expect(humanWonLocalMatch(game, 'ai')).toBe(false);
  });
});
