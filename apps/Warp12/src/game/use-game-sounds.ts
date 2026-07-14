import { useEffect, useRef } from 'react';

import { playGameSound, playTurnBeepById, stopGameSound, type GameSound } from './game-sounds.js';

/** Gap between stacked beep events on the same frame (ms). */
const BEEP_STAGGER_MS = 120;

/** Stable chart chirp slot 1–77 — pentatonic pitch via musical-chirp-synth. */
export function chartSlotForPlayer(playerId: string): number {
  let hash = 0;
  for (let i = 0; i < playerId.length; i += 1) {
    hash = (hash * 31 + playerId.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 77) + 1;
}

export interface GameSoundSnapshot {
  gamePhase: string;
  roundPhase: string | undefined;
  isMyTurn: boolean;
  /** Charted doubles on the table (each play increments this). */
  doublesOnTable: number;
  /** Tiles on the table (trails, neutral zone, open fracture stabilizers). */
  chartedTileCount: number;
  /**
   * Full Red alert bridge lighting (after the first pass).
   * Yellow alert (fresh double) is intentionally excluded — only consoleWarning
   * fires then.
   */
  illuminatedRedAlert: boolean;
  redAlertResponsibleId: string | null;
  activeBeaconCount: number;
  flashActive: boolean;
  allStopDeclared: boolean;
  allStopRequired: boolean;
  activePlayerId: string | null;
  dropToImpulseCallPending: string | null;
  dropToImpulseCatchable: string | null;
  /** Engine signal: a draw just grew an at-impulse hand back to warp. */
  returnedToWarp: boolean;
  /** Engine signal: wormhole opened (captain's trail swapped with the Neutral Zone). */
  wormholeOpened: boolean;
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

  // Red alert klaxon follows full Red lighting (post-pass), not Yellow alert.
  if (next.illuminatedRedAlert && !previous.illuminatedRedAlert) {
    play.push('redAlert');
  }

  if (previous.illuminatedRedAlert && !next.illuminatedRedAlert) {
    stop.push('redAlert');
  }

  if (next.flashActive && !previous.flashActive) {
    play.push('flash');
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

  if (next.wormholeOpened && !previous.wormholeOpened) {
    play.push('wormhole');
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
  illuminatedRedAlert: boolean;
  redAlertResponsibleId: string | null;
  activeBeaconCount: number;
  flashActive: boolean;
  allStopDeclared: boolean;
  allStopRequired: boolean;
  dropToImpulseCallPending: string | null;
  dropToImpulseCatchable: string | null;
  returnedToWarp: boolean;
  wormholeOpened: boolean;
  unchartedSectorCount: number;
  turnBeepsEnabled: boolean;
}): void {
  const previous = useRef<GameSoundSnapshot | null>(null);
  const turnChirpForPlayer = useRef<{
    playerId: string | null;
    chartSlot: number | null;
  }>({ playerId: null, chartSlot: null });

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    if (options.turnBeepsEnabled && options.activePlayerId) {
      if (turnChirpForPlayer.current.playerId !== options.activePlayerId) {
        turnChirpForPlayer.current = {
          playerId: options.activePlayerId,
          chartSlot: chartSlotForPlayer(options.activePlayerId),
        };
      }
    } else if (!options.turnBeepsEnabled) {
      turnChirpForPlayer.current = { playerId: null, chartSlot: null };
    }

    const snapshot: GameSoundSnapshot = {
      gamePhase: options.gamePhase,
      roundPhase: options.roundPhase,
      isMyTurn: options.isMyTurn,
      doublesOnTable: options.doublesOnTable,
      chartedTileCount: options.chartedTileCount,
      illuminatedRedAlert: options.illuminatedRedAlert,
      redAlertResponsibleId: options.redAlertResponsibleId,
      activeBeaconCount: options.activeBeaconCount,
      flashActive: options.flashActive,
      allStopDeclared: options.allStopDeclared,
      allStopRequired: options.allStopRequired,
      activePlayerId: options.activePlayerId,
      dropToImpulseCallPending: options.dropToImpulseCallPending,
      dropToImpulseCatchable: options.dropToImpulseCatchable,
      returnedToWarp: options.returnedToWarp,
      wormholeOpened: options.wormholeOpened,
      unchartedSectorCount: options.unchartedSectorCount,
      turnBeepsEnabled: options.turnBeepsEnabled,
    };

    const transition = detectGameSoundTransitions(previous.current, snapshot);
    for (const sound of transition.stop) {
      stopGameSound(sound);
    }

    let beepDelayMs = 0;
    for (const sound of transition.play) {
      if (sound === 'consoleWarning' || sound === 'hail') {
        playGameSound(sound, { delayMs: beepDelayMs });
        beepDelayMs += BEEP_STAGGER_MS;
      } else {
        playGameSound(sound);
      }
    }

    const turnBeeps = countTurnBeepsToPlay(previous.current, snapshot);
    const chartSlot = turnChirpForPlayer.current.chartSlot;
    if (chartSlot !== null) {
      for (let i = 0; i < turnBeeps; i += 1) {
        playTurnBeepById(chartSlot, { delayMs: beepDelayMs });
        beepDelayMs += BEEP_STAGGER_MS;
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
    options.illuminatedRedAlert,
    options.redAlertResponsibleId,
    options.activeBeaconCount,
    options.flashActive,
    options.roundPhase,
    options.allStopDeclared,
    options.allStopRequired,
    options.dropToImpulseCallPending,
    options.dropToImpulseCatchable,
    options.returnedToWarp,
    options.wormholeOpened,
    options.unchartedSectorCount,
    options.turnBeepsEnabled,
  ]);

  useEffect(() => {
    turnChirpForPlayer.current = { playerId: null, chartSlot: null };
    if (previous.current) {
      previous.current = {
        ...previous.current,
        isMyTurn: false,
        chartedTileCount: 0,
      };
    }
  }, [options.roundNumber]);
}
