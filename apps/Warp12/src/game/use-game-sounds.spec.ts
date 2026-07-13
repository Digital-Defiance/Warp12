import { describe, expect, it } from 'vitest';

import {
  chartSlotForPlayer,
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
    flashActive: false,
    allStopDeclared: false,
    allStopRequired: false,
    activePlayerId: null,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    returnedToWarp: false,
    unchartedSectorCount: 10,
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

  it('plays red alert when a double first opens red alert', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        doublesOnTable: 1,
        trueRedAlert: true,
        redAlertResponsibleId: 'a',
      })
    ).toEqual({ play: ['consoleWarning', 'redAlert'], stop: [] });
  });

  it('plays red alert when red alert becomes active', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          doublesOnTable: 1,
          trueRedAlert: false,
          redAlertResponsibleId: null,
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

  it('keeps red alert playing when the responsible player changes', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          trueRedAlert: true,
          redAlertResponsibleId: 'a',
          activeBeaconCount: 1,
        },
        {
          ...base,
          trueRedAlert: true,
          redAlertResponsibleId: 'b',
          activeBeaconCount: 2,
        }
      )
    ).toEqual({ play: [], stop: [] });
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

  it('does not play red alert when a beacon deploys without red alert being active', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          trueRedAlert: false,
          redAlertResponsibleId: null,
          activeBeaconCount: 0,
        },
        {
          ...base,
          trueRedAlert: false,
          redAlertResponsibleId: null,
          activeBeaconCount: 1,
        }
      )
    ).toEqual({ play: [], stop: [] });
  });

  it('plays Continuum Flash when the Continuum module activates', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        flashActive: true,
      })
    ).toEqual({ play: ['flash'], stop: [] });
  });

  it('plays powering down for All Stop declarations', () => {
    expect(
      detectGameSoundTransitions(base, {
        ...base,
        allStopDeclared: true,
        allStopRequired: true,
      })
    ).toEqual({ play: ['allStop'], stop: [] });

    expect(
      detectGameSoundTransitions(base, {
        ...base,
        allStopDeclared: true,
        allStopRequired: false,
      })
    ).toEqual({ play: [], stop: [] });
  });

  it('plays warp exit when Drop to Impulse is declared (turn advances)', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          activePlayerId: 'a',
          dropToImpulseCallPending: 'a',
          dropToImpulseCatchable: null,
        },
        {
          ...base,
          activePlayerId: 'b',
          dropToImpulseCallPending: null,
          dropToImpulseCatchable: null,
        }
      )
    ).toEqual({ play: ['dropToImpulse'], stop: [] });
  });

  it('does not play warp exit when passing without declaring opens the catch window', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          activePlayerId: 'a',
          dropToImpulseCallPending: 'a',
          dropToImpulseCatchable: null,
        },
        {
          ...base,
          activePlayerId: 'b',
          dropToImpulseCallPending: null,
          dropToImpulseCatchable: 'a',
        }
      )
    ).toEqual({ play: [], stop: [] });
  });

  it('plays return to warp when the engine signals it (draw grew an at-impulse hand)', () => {
    expect(
      detectGameSoundTransitions(
        { ...base, unchartedSectorCount: 5 },
        { ...base, returnedToWarp: true, unchartedSectorCount: 4 }
      )
    ).toEqual({ play: ['returnToWarp'], stop: [] });
  });

  it('plays return to warp for an announced-then-drawn captain (no impulse flags set)', () => {
    // Regression: announcing Drop to Impulse clears the flags, so flag-based
    // detection missed this path. The engine signal covers it.
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          activePlayerId: 'a',
          dropToImpulseCallPending: null,
          dropToImpulseCatchable: null,
          unchartedSectorCount: 5,
        },
        {
          ...base,
          activePlayerId: 'a',
          dropToImpulseCallPending: null,
          dropToImpulseCatchable: null,
          returnedToWarp: true,
          unchartedSectorCount: 4,
        }
      )
    ).toEqual({ play: ['returnToWarp'], stop: [] });
  });

  it('does not play return to warp on a normal draw while not at impulse', () => {
    expect(
      detectGameSoundTransitions(
        { ...base, unchartedSectorCount: 5 },
        { ...base, returnedToWarp: false, unchartedSectorCount: 4 }
      )
    ).toEqual({ play: [], stop: [] });
  });

  it('plays return to warp only once (edge-triggered while the signal stays set)', () => {
    expect(
      detectGameSoundTransitions(
        { ...base, returnedToWarp: true, unchartedSectorCount: 4 },
        { ...base, returnedToWarp: true, unchartedSectorCount: 4 }
      )
    ).toEqual({ play: [], stop: [] });
  });

  it('does not play drop to impulse when drawing ends impulse on the same turn', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          activePlayerId: 'a',
          dropToImpulseCallPending: 'a',
          dropToImpulseCatchable: null,
          unchartedSectorCount: 5,
        },
        {
          ...base,
          activePlayerId: 'a',
          dropToImpulseCallPending: null,
          dropToImpulseCatchable: null,
          unchartedSectorCount: 4,
        }
      ).play
    ).not.toContain('dropToImpulse');
  });

  it('is silent when the Drop to Impulse catch window closes without a catch', () => {
    expect(
      detectGameSoundTransitions(
        {
          ...base,
          dropToImpulseCatchable: 'a',
          unchartedSectorCount: 5,
        },
        {
          ...base,
          dropToImpulseCatchable: null,
          unchartedSectorCount: 5,
        }
      )
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
    flashActive: false,
    allStopDeclared: false,
    allStopRequired: false,
    activePlayerId: null,
    dropToImpulseCallPending: null,
    dropToImpulseCatchable: null,
    returnedToWarp: false,
    unchartedSectorCount: 10,
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

describe('chartSlotForPlayer', () => {
  it('returns a stable slot in 1–77 per captain id', () => {
    expect(chartSlotForPlayer('captain-a')).toBe(chartSlotForPlayer('captain-a'));
    expect(chartSlotForPlayer('captain-a')).toBeGreaterThanOrEqual(1);
    expect(chartSlotForPlayer('captain-a')).toBeLessThanOrEqual(77);
    expect(chartSlotForPlayer('captain-a')).not.toBe(chartSlotForPlayer('captain-b'));
  });
});
