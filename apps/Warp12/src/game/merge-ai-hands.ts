import type { GameState } from 'warp12-engine';

type Coordinate = { low: number; high: number };

export function mergeAiHandsIntoGame(
  game: GameState,
  aiHands: Readonly<Record<string, readonly Coordinate[]>>
): GameState {
  if (!game.round) {
    return game;
  }

  return {
    ...game,
    round: {
      ...game.round,
      hands: {
        ...game.round.hands,
        ...Object.fromEntries(
          Object.entries(aiHands).map(([captainId, coordinates]) => [
            captainId,
            [...coordinates],
          ])
        ),
      },
    },
  };
}
