import { describe, expect, it } from 'vitest';

import { createLocalGame } from './create-local-game.js';
import { suggestConsoleHumanAction } from './local-game-console-play.js';
import { defaultLocalGameConfig } from './local-game-config.js';

describe('suggestConsoleHumanAction', () => {
  it('returns null when it is not the human turn', () => {
    const game = createLocalGame(defaultLocalGameConfig('You', 2), 42);
    const active = game.round!.activePlayerId;
    const other = game.round!.turnOrder.find((id) => id !== active)!;
    expect(suggestConsoleHumanAction(game, other, 'random')).toBeNull();
  });

  it('suggests a chart (or all-stop/draw) for the active human on random mode', () => {
    const game = createLocalGame(defaultLocalGameConfig('You', 2), 42);
    const humanId = 'you';
    // Force human to be active for a deterministic assertion.
    const forced = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            activePlayerId: humanId,
            phase: 'playing' as const,
          }
        : null,
    };
    const action = suggestConsoleHumanAction(forced, humanId, 'random');
    expect(action).not.toBeNull();
    expect(action!.playerId).toBe(humanId);
  });

  it('suggests an advisor action when mode is advisor', () => {
    const game = createLocalGame(defaultLocalGameConfig('You', 2), 99);
    const humanId = 'you';
    const forced = {
      ...game,
      round: game.round
        ? {
            ...game.round,
            activePlayerId: humanId,
            phase: 'playing' as const,
          }
        : null,
    };
    const action = suggestConsoleHumanAction(forced, humanId, 'advisor');
    expect(action).not.toBeNull();
    expect(action!.playerId).toBe(humanId);
  });
});
