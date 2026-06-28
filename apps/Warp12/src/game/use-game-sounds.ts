import { useEffect, useRef } from 'react';

import { playGameSound, type GameSound } from './game-sounds.js';

export interface GameSoundSnapshot {
  gamePhase: string;
  roundPhase: string | undefined;
  isMyTurn: boolean;
  redAlertActive: boolean;
  qFlashActive: boolean;
  treatyDeclared: boolean;
  treatyDeclarationRequired: boolean;
}

export function detectGameSoundTransitions(
  previous: GameSoundSnapshot | null,
  next: GameSoundSnapshot
): GameSound[] {
  if (previous == null || next.gamePhase !== 'active') {
    return [];
  }

  const sounds: GameSound[] = [];

  if (next.isMyTurn && !previous.isMyTurn && next.roundPhase === 'playing') {
    sounds.push('hail');
  }

  if (next.redAlertActive && !previous.redAlertActive) {
    sounds.push('redAlert');
  }

  if (next.qFlashActive && !previous.qFlashActive) {
    sounds.push('qFlash');
  }

  if (
    !previous.treatyDeclared &&
    next.treatyDeclared &&
    next.treatyDeclarationRequired
  ) {
    sounds.push('warpExit');
  }

  return sounds;
}

export function useGameSoundEffects(options: {
  enabled: boolean;
  gamePhase: string;
  roundPhase: string | undefined;
  roundNumber: number | undefined;
  isMyTurn: boolean;
  redAlertActive: boolean;
  qFlashActive: boolean;
  treatyDeclared: boolean;
  treatyDeclarationRequired: boolean;
}): void {
  const previous = useRef<GameSoundSnapshot | null>(null);

  useEffect(() => {
    if (!options.enabled) {
      return;
    }

    const snapshot: GameSoundSnapshot = {
      gamePhase: options.gamePhase,
      roundPhase: options.roundPhase,
      isMyTurn: options.isMyTurn,
      redAlertActive: options.redAlertActive,
      qFlashActive: options.qFlashActive,
      treatyDeclared: options.treatyDeclared,
      treatyDeclarationRequired: options.treatyDeclarationRequired,
    };

    for (const sound of detectGameSoundTransitions(previous.current, snapshot)) {
      playGameSound(sound);
    }

    previous.current = snapshot;
  }, [
    options.enabled,
    options.gamePhase,
    options.isMyTurn,
    options.redAlertActive,
    options.qFlashActive,
    options.roundPhase,
    options.treatyDeclared,
    options.treatyDeclarationRequired,
  ]);

  useEffect(() => {
    if (previous.current) {
      previous.current = { ...previous.current, isMyTurn: false };
    }
  }, [options.roundNumber]);
}
