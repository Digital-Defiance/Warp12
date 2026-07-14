import { describe, expect, it } from 'vitest';

import {
  buildAiCaptains,
  buildHumanCaptains,
  clampLocalPlayerCount,
  defaultLocalGameConfig,
  isPassAndPlay,
  isRatedLocalGame,
  LOCAL_MIN_PLAYERS,
  neuralAiSupported,
  soloHumanCaptain,
} from './local-game-config.js';

describe('local-game-config', () => {
  it('treats solo vs AI as rated-capable', () => {
    const config = defaultLocalGameConfig('Armstrong', 4);
    expect(config.humanCaptains).toEqual([soloHumanCaptain('Armstrong')]);
    expect(isPassAndPlay(config)).toBe(false);
    expect(isRatedLocalGame(config)).toBe(true);
  });

  it('blocks TEI when Warped modules are enabled', () => {
    const config = {
      ...defaultLocalGameConfig('Armstrong', 4),
      modules: { drafting: true },
    };
    expect(isRatedLocalGame(config)).toBe(false);
  });

  it('supports a heads-up solo game (2 players: one human vs one AI)', () => {
    expect(LOCAL_MIN_PLAYERS).toBe(2);
    expect(clampLocalPlayerCount(2)).toBe(2);
    const config = defaultLocalGameConfig('Armstrong', 2);
    expect(config.playerCount).toBe(2);
    expect(config.humanCaptains).toEqual([soloHumanCaptain('Armstrong')]);
    expect(config.aiCaptains).toHaveLength(1);
    expect(isPassAndPlay(config)).toBe(false);
    expect(isRatedLocalGame(config)).toBe(true);
  });

  it('builds a single AI opponent for a heads-up game', () => {
    expect(buildAiCaptains(1)).toHaveLength(1);
  });

  it('clamps and fills AI seats for Warp 18 fleets', () => {
    expect(clampLocalPlayerCount(18, 18)).toBe(18);
    expect(clampLocalPlayerCount(18, 12)).toBe(8);
    expect(buildAiCaptains(17, 18)).toHaveLength(17);
  });

  it('reports neural weights only where they ship (Warp 12 today)', () => {
    expect(neuralAiSupported(12)).toBe(true);
    expect(neuralAiSupported(9)).toBe(false);
    expect(neuralAiSupported(15)).toBe(false);
    expect(neuralAiSupported(18)).toBe(false);
  });

  it('does not default exhibition fleets to Commander (Ω) seats', () => {
    const exhibition = buildAiCaptains(3, 18);
    expect(exhibition.every((ai) => ai.skill === 'lieutenant')).toBe(true);
    const rated = buildAiCaptains(3, 12);
    expect(rated.some((ai) => ai.skill === 'commander')).toBe(true);
  });

  it('treats non-12 factors as exhibition (unrated)', () => {
    expect(isRatedLocalGame(defaultLocalGameConfig('Armstrong', 4, 18))).toBe(
      false
    );
    expect(isRatedLocalGame(defaultLocalGameConfig('Armstrong', 4, 12))).toBe(
      true
    );
  });

  it('honors rated: false as casual (advisor allowed)', () => {
    const config = {
      ...defaultLocalGameConfig('Armstrong', 4),
      rated: false as const,
    };
    expect(isRatedLocalGame(config)).toBe(false);
  });

  it('treats two or more human seats as pass-and-play', () => {
    const config = {
      ...defaultLocalGameConfig('Armstrong', 4),
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
