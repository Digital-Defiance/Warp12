import { describe, expect, it } from 'vitest';

import {
  countTurnBeepsToPlay,
  detectGameSoundTransitions,
  type GameSoundSnapshot,
} from './use-game-sounds.js';

describe('detectGameSoundTransitions', () => {
  const base: GameSoundSnapshot = {
    gamePhase: 'active',
    roundPhase: 'playing',
    isMyTurn: false,
    doublesOnTable: 0,
    chartedTileCount: 0,
    trueRedAlert: false,
    redAlertResponsibleId: null,
    activeBeaconCount: 0,
    qFlashActive: false,
    dropToImpulseDeclared: false,
    dropToImpulseRequired: false,
    turnBeepsEnabled: false,
  };

  it('plays hail when helm passes to you', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        isMyTurn: true,
      })
    ).toEqual({ play: ['hail'], stop: [] });
  });

  it('plays console warning when a double is charted', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        doublesOnTable: 1,
      })
    ).toEqual({ play: ['consoleWarning'], stop: [] });
  });

  it('does not play red alert when a double first opens red alert', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        doublesOnTable: 1,
        trueRedAlert: true,
        redAlertResponsibleId: 'a',
      })
    ).toEqual({ play: ['consoleWarning'], stop: [] });
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
    ).toEqual({ play: ['redAlert'], stop: [] });
  });

  it('stops red alert when red alert is cleared', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          doublesOnTable: 1,
          trueRedAlert: true,
          redAlertResponsibleId: 'a',
        },
        {
          ...base,
          doublesOnTable: 1,
          trueRedAlert: false,
          redAlertResponsibleId: null,
        }
      )
    ).toEqual({ play: [], stop: ['redAlert'] });
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
    ).toEqual({ play: [], stop: [] });
  });

  it('plays q flash when the Q-Continuum module activates', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        qFlashActive: true,
      })
    ).toEqual({ play: ['qFlash'], stop: [] });
  });

  it('plays warp exit only for impulse declarations', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        dropToImpulseDeclared: true,
        dropToImpulseRequired: true,
      })
    ).toEqual({ play: ['warpExit'], stop: [] });

    expect(
      detectGameSoundTransitions(base, {
        ...base,
        dropToImpulseDeclared: true,
        dropToImpulseRequired: false,
      })
    ).toEqual({ play: [], stop: [] });
  });

  it('skips hail on the first snapshot', () => {
    expect(detectGameSoundTransitions(null, { ...base, isMyTurn: true })).toEqual(
      { play: [], stop: [] }
    );
  });
});

describe('countTurnBeepsToPlay', () => {
  const base: GameSoundSnapshot = {
    gamePhase: 'active',
    roundPhase: 'playing',
    isMyTurn: false,
    doublesOnTable: 0,
    chartedTileCount: 2,
    trueRedAlert: false,
    redAlertResponsibleId: null,
    activeBeaconCount: 0,
    qFlashActive: false,
    dropToImpulseDeclared: false,
    dropToImpulseRequired: false,
    turnBeepsEnabled: true,
  };

  it('plays once per newly charted tile when enabled', () => {
    expect(
      countTurnBeepsToPlay(base, { ...base, chartedTileCount: 3 })
    ).toBe(1);
  });

  it('plays for each tile when several are charted in one update', () => {
    expect(
      countTurnBeepsToPlay(base, { ...base, chartedTileCount: 5 })
    ).toBe(3);
  });

  it('is silent when turn beeps are disabled', () => {
    expect(
      countTurnBeepsToPlay(base, {
        ...base,
        turnBeepsEnabled: false,
        chartedTileCount: 3,
      })
    ).toBe(0);
  });
});
