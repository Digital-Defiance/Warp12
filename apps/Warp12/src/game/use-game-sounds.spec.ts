import { describe, expect, it } from 'vitest';

import {
  detectGameSoundTransitions,
  type GameSoundSnapshot,
} from './use-game-sounds.js';

describe('detectGameSoundTransitions', () => {
  const base: GameSoundSnapshot = {
    gamePhase: 'active',
    roundPhase: 'playing',
    isMyTurn: false,
    redAlertActive: false,
    qFlashActive: false,
    treatyDeclared: false,
    treatyDeclarationRequired: false,
  };

  it('plays hail when helm passes to you', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        isMyTurn: true,
      })
    ).toEqual(['hail']);
  });

  it('plays red alert when alert activates', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        redAlertActive: true,
      })
    ).toEqual(['redAlert']);
  });

  it('plays q flash when the Q-Continuum module activates', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        qFlashActive: true,
      })
    ).toEqual(['qFlash']);
  });

  it('plays warp exit only for impulse declarations', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        treatyDeclared: true,
        treatyDeclarationRequired: true,
      })
    ).toEqual(['warpExit']);

    expect(
      detectGameSoundTransitions(base, {
        ...base,
        treatyDeclared: true,
        treatyDeclarationRequired: false,
      })
    ).toEqual([]);
  });

  it('skips hail on the first snapshot', () => {
    expect(detectGameSoundTransitions(null, { ...base, isMyTurn: true })).toEqual(
      []
    );
  });
});
