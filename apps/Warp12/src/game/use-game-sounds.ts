import { useEffect, useRef } from 'react';

import {
  computerBeepUrl,
  pickRandomComputerBeepId,
} from './computer-beeps.js';
import { playGameSound, playTurnBeep, stopGameSound, type GameSound } from './game-sounds.js';

export interface GameSoundSnapshot {
  gamePhase: string;
  roundPhase: string | undefined;
  isMyTurn: boolean;
  /** Charted doubles on the table (each play increments this). */
  doublesOnTable: number;
  /** Tiles on the table (trails, neutral zone, open fracture stabilizers). */
  chartedTileCount: number;
  /** Cover-required Red Alert (excludes dead doubles). */
  trueRedAlert: boolean;
  redAlertResponsibleId: string | null;
  activeBeaconCount: number;
  qFlashActive: boolean;
  allStopDeclared: boolean;
  allStopRequired: boolean;
  activePlayerId: string | null;
  dropToImpulseCallPending: string | null;
  dropToImpulseCatchable: string | null;
  /** Engine signal: a draw just grew an at-impulse hand back to warp. */
  returnedToWarp: boolean;
  unchartedSectorCount: number;
  turnBeepsEnabled: boolean;
}

export interface GameSoundTransition {
  readonly play: readonly GameSound[];
  readonly stop: readonly GameSound[];
}

export function detectGameSoundTransitions(
  previous: GameSoundSnapshot | null,
  next: GameSoundSnapshot
): GameSoundTransition {
  if (previous == null || next.gamePhase !== 'active') {
    return { play: [], stop: [] };
  }

  const play: GameSound[] = [];
  const stop: GameSound[] = [];

  if (next.isMyTurn && !previous.isMyTurn && next.roundPhase === 'playing') {
    play.push('hail');
  }

  if (next.doublesOnTable > previous.doublesOnTable) {
    play.push('consoleWarning');
  }

  if (
    next.trueRedAlert &&
    previous.trueRedAlert &&
    next.redAlertResponsibleId !== previous.redAlertResponsibleId &&
    next.activeBeaconCount > previous.activeBeaconCount
  ) {
    play.push('redAlert');
  }

  if (previous.trueRedAlert && !next.trueRedAlert) {
    stop.push('redAlert');
  }

  if (next.qFlashActive && !previous.qFlashActive) {
    play.push('qFlash');
  }

  if (
    !previous.allStopDeclared &&
    next.allStopDeclared &&
    next.allStopRequired
  ) {
    play.push('allStop');
  }

  if (
    previous.dropToImpulseCallPending &&
    !next.dropToImpulseCallPending &&
    !next.dropToImpulseCatchable &&
    next.unchartedSectorCount >= previous.unchartedSectorCount
  ) {
    play.push('dropToImpulse');
  }

  if (next.returnedToWarp && !previous.returnedToWarp) {
    play.push('returnToWarp');
  }

  return { play, stop };
}

/** Play a turn beep for each new tile charted on the table. */
export function countTurnBeepsToPlay(
  previous: GameSoundSnapshot | null,
  next: GameSoundSnapshot
): number {
  if (
    previous == null ||
    next.gamePhase !== 'active' ||
    !next.turnBeepsEnabled
  ) {
    return 0;
  }
  const delta = next.chartedTileCount - previous.chartedTileCount;
  return delta > 0 ? delta : 0;
}

export function useGameSoundEffects(options: {
  enabled: boolean;
  gamePhase: string;
  roundPhase: string | undefined;
  roundNumber: number | undefined;
  isMyTurn: boolean;
  activePlayerId: string | null;
  doublesOnTable: number;
  chartedTileCount: number;
  trueRedAlert: boolean;
  redAlertResponsibleId: string | null;
  activeBeaconCount: number;
  qFlashActive: boolean;
  allStopDeclared: boolean;
  allStopRequired: boolean;
  dropToImpulseCallPending: string | null;
  dropToImpulseCatchable: string | null;
  returnedToWarp: boolean;
  unchartedSectorCount: number;
  turnBeepsEnabled: boolean;
}): void {
  const previous = useRef<GameSoundSnapshot | null>(null);
  const turnBeepForPlayer = useRef<{ playerId: string | null; url: string | null }>(
    { playerId: null, url: null }
  );

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    if (options.turnBeepsEnabled && options.activePlayerId) {
      if (turnBeepForPlayer.current.playerId !== options.activePlayerId) {
        turnBeepForPlayer.current = {
          playerId: options.activePlayerId,
          url: computerBeepUrl(pickRandomComputerBeepId()),
        };
      }
    } else if (!options.turnBeepsEnabled) {
      turnBeepForPlayer.current = { playerId: null, url: null };
    }

    const snapshot: GameSoundSnapshot = {
      gamePhase: options.gamePhase,
      roundPhase: options.roundPhase,
      isMyTurn: options.isMyTurn,
      doublesOnTable: options.doublesOnTable,
      chartedTileCount: options.chartedTileCount,
      trueRedAlert: options.trueRedAlert,
      redAlertResponsibleId: options.redAlertResponsibleId,
      activeBeaconCount: options.activeBeaconCount,
      qFlashActive: options.qFlashActive,
      allStopDeclared: options.allStopDeclared,
      allStopRequired: options.allStopRequired,
      activePlayerId: options.activePlayerId,
      dropToImpulseCallPending: options.dropToImpulseCallPending,
      dropToImpulseCatchable: options.dropToImpulseCatchable,
      returnedToWarp: options.returnedToWarp,
      unchartedSectorCount: options.unchartedSectorCount,
      turnBeepsEnabled: options.turnBeepsEnabled,
    };

    const transition = detectGameSoundTransitions(previous.current, snapshot);
    for (const sound of transition.stop) {
      stopGameSound(sound);
    }
    for (const sound of transition.play) {
      playGameSound(sound);
    }

    const turnBeeps = countTurnBeepsToPlay(previous.current, snapshot);
    const turnBeepUrl = turnBeepForPlayer.current.url;
    if (turnBeepUrl) {
      for (let i = 0; i < turnBeeps; i += 1) {
        playTurnBeep(turnBeepUrl);
      }
    }

    previous.current = snapshot;
  }, [
    options.enabled,
    options.gamePhase,
    options.isMyTurn,
    options.activePlayerId,
    options.doublesOnTable,
    options.chartedTileCount,
    options.trueRedAlert,
    options.redAlertResponsibleId,
    options.activeBeaconCount,
    options.qFlashActive,
    options.roundPhase,
    options.allStopDeclared,
    options.allStopRequired,
    options.dropToImpulseCallPending,
    options.dropToImpulseCatchable,
    options.returnedToWarp,
    options.unchartedSectorCount,
    options.turnBeepsEnabled,
  ]);

  useEffect(() => {
    turnBeepForPlayer.current = { playerId: null, url: null };
    if (previous.current) {
      previous.current = {
        ...previous.current,
        isMyTurn: false,
        chartedTileCount: 0,
      };
    }
  }, [options.roundNumber]);
}
