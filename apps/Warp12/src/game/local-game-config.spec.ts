import { describe, expect, it } from 'vitest';

import {
  buildAiCaptains,
  buildHumanCaptains,
  clampLocalPlayerCount,
  defaultLocalGameConfig,
  isPassAndPlay,
  isRatedLocalGame,
  LOCAL_MIN_PLAYERS,
  soloHumanCaptain,
} from './local-game-config.js';

describe('local-game-config', () => {
  it('treats solo vs AI as rated-capable', () => {
    const config = defaultLocalGameConfig('Picard', 4);
    expect(config.humanCaptains).toEqual([soloHumanCaptain('Picard')]);
    expect(isPassAndPlay(config)).toBe(false);
    expect(isRatedLocalGame(config)).toBe(true);
  });

  it('supports a heads-up solo game (2 players: one human vs one AI)', () => {
    expect(LOCAL_MIN_PLAYERS).toBe(2);
    expect(clampLocalPlayerCount(2)).toBe(2);
    const config = defaultLocalGameConfig('Picard', 2);
    expect(config.playerCount).toBe(2);
    expect(config.humanCaptains).toEqual([soloHumanCaptain('Picard')]);
    expect(config.aiCaptains).toHaveLength(1);
    expect(isPassAndPlay(config)).toBe(false);
    expect(isRatedLocalGame(config)).toBe(true);
  });

  it('builds a single AI opponent for a heads-up game', () => {
    expect(buildAiCaptains(1)).toHaveLength(1);
  });

  it('treats two or more human seats as pass-and-play', () => {
    const config = {
      ...defaultLocalGameConfig('Picard', 4),
      humanCaptains: buildHumanCaptains(3),
    };
    expect(isPassAndPlay(config)).toBe(true);
    expect(isRatedLocalGame(config)).toBe(false);
  });

  it('builds stable human seat ids', () => {
    expect(buildHumanCaptains(2).map((human) => human.id)).toEqual([
      'human:0',
      'human:1',
    ]);
  });
});
