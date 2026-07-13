import { describe, expect, it } from 'vitest';

import {
  classifyLocalAiMatchOpponent,
  classifyLocalAiMatchSkill,
} from './local-match-stats.js';

describe('classifyLocalAiMatchSkill', () => {
  it('picks the highest skill tier', () => {
    expect(
      classifyLocalAiMatchSkill([
        { id: 'a', displayName: 'A', skill: 'ensign' },
        { id: 'b', displayName: 'B', skill: 'commander' },
      ])
    ).toBe('commander');
  });
});

describe('classifyLocalAiMatchOpponent', () => {
  it('treats Commander as rated (opponentOmega false)', () => {
    expect(
      classifyLocalAiMatchOpponent([
        { id: 'a', displayName: 'Lovell', skill: 'commander' },
        { id: 'b', displayName: 'Earhart', skill: 'commander' },
      ])
    ).toEqual({ skill: 'commander', opponentOmega: false });
  });

  it('ignores legacy omega flags for rating classification', () => {
    expect(
      classifyLocalAiMatchOpponent([
        { id: 'a', displayName: 'Lovell', skill: 'commander', omega: true },
      ])
    ).toEqual({ skill: 'commander', opponentOmega: false });
  });
});
