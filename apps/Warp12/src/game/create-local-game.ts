import {
  createWarpAiPlayer,
  generateCoordinateSet,
  getWarpSkillProfile,
  shuffleCoordinates,
  startGame,
  type GameObjective,
  type GameState,
  type WarpAiPlayer,
} from '@warp12/Warp12-lib';

import type { LocalGameConfig } from './local-game-config.js';

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createLocalGame(
  config: LocalGameConfig,
  seed = Date.now()
): GameState {
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    seededRandom(seed)
  );
  const captains = [
    { id: config.humanId, displayName: config.humanName },
    ...config.aiCaptains.map((ai) => ({
      id: ai.id,
      displayName: ai.displayName,
    })),
  ];

  return startGame(
    {
      id: `local-${seed}`,
      captains,
      modules: config.modules,
      objective: config.objective,
    },
    { shuffledCoordinates: shuffled, roundStarterId: config.humanId }
  );
}

export function buildAiRosterFromConfigs(
  aiCaptains: readonly AiCaptainConfig[],
  objective: GameObjective,
  seed: number
): ReadonlyMap<string, WarpAiPlayer> {
  const roster = new Map<string, WarpAiPlayer>();
  for (const [index, ai] of aiCaptains.entries()) {
    roster.set(
      ai.id,
      createWarpAiPlayer({
        skill: getWarpSkillProfile(ai.skill, objective),
        objective,
        lookahead: ai.useLookahead
          ? { depth: 2, determinizations: 4, maxBranch: 5 }
          : undefined,
        rng: mulberry32(seed + (index + 1) * 997),
      })
    );
  }
  return roster;
}

export function buildAiRoster(
  config: LocalGameConfig,
  seed: number
): ReadonlyMap<string, WarpAiPlayer> {
  return buildAiRosterFromConfigs(config.aiCaptains, config.objective, seed);
}
