import {
  generateCoordinateSet,
  shuffleCoordinates,
  startGame,
  type GameState,
} from '@warp12/Warp12-lib';

export const DEMO_CAPTAINS = [
  { id: 'you', displayName: 'You' },
  { id: 'riker', displayName: 'Riker' },
  { id: 'troi', displayName: 'Troi' },
  { id: 'worf', displayName: 'Worf' },
] as const;

function seededRandom(seed: number): () => number {
  let value = seed;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function createDemoGame(seed = Date.now()): GameState {
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    seededRandom(seed)
  );

  return startGame(
    {
      id: `demo-${seed}`,
      captains: [...DEMO_CAPTAINS],
      modules: { salamanderPenalty: true },
    },
    { shuffledCoordinates: shuffled }
  );
}

export function captainNameMap(
  state: GameState
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    state.captains.map((captain) => [captain.id, captain.displayName])
  );
}
