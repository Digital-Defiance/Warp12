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
    doublesOnTable: 0,
    trueRedAlert: false,
    redAlertResponsibleId: null,
    activeBeaconCount: 0,
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

  it('plays console warning when a double is charted', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        doublesOnTable: 1,
      })
    ).toEqual(['consoleWarning']);
  });

  it('does not play red alert when a double first opens red alert', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        doublesOnTable: 1,
        trueRedAlert: true,
        redAlertResponsibleId: 'a',
      })
    ).toEqual(['consoleWarning']);
  });

  it('plays red alert when red alert is passed and a beacon deploys', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          doublesOnTable: 1,
          trueRedAlert: true,
          redAlertResponsibleId: 'a',
          activeBeaconCount: 0,
        },
        {
          ...base,
          doublesOnTable: 1,
          trueRedAlert: true,
          redAlertResponsibleId: 'b',
          activeBeaconCount: 1,
        }
      )
    ).toEqual(['redAlert']);
  });

  it('does not play red alert when a beacon deploys without passing red alert', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          trueRedAlert: true,
          redAlertResponsibleId: 'a',
          activeBeaconCount: 0,
        },
        {
          ...base,
          trueRedAlert: true,
          redAlertResponsibleId: 'a',
          activeBeaconCount: 1,
        }
      )
    ).toEqual([]);
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
