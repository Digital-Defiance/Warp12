import { describe, expect, it } from 'vitest';

import {
  buildHumanCaptains,
  defaultLocalGameConfig,
  isPassAndPlay,
  isRatedLocalGame,
  soloHumanCaptain,
} from './local-game-config.js';

describe('local-game-config', () => {
  it('treats solo vs AI as rated-capable', () => {
    const config = defaultLocalGameConfig('Picard', 4);
    expect(config.humanCaptains).toEqual([soloHumanCaptain('Picard')]);
    expect(isPassAndPlay(config)).toBe(false);
    expect(isRatedLocalGame(config)).toBe(true);
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
