import {
  createOmegaPlayer,
  createOmegaSearchPlayer,
  createRoundStateFromDeal,
  createRoundStateWithDraft,
  createWarpAiPlayer,
  dealRoundFromShuffled,
  generateCoordinateSet,
  getWarpSkillProfile,
  shuffleCoordinates,
  startGame,
  type GameObjective,
  type GameState,
  type OmegaModelWeights,
  type WarpAiPlayer,
} from 'warp12-engine';

import { preloadOmegaWeights } from '../ai/load-omega-weights.js';
import type { AiCaptainConfig, LocalGameConfig } from './local-game-config.js';
import { neuralAiSupported } from './local-game-config.js';

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

/** Seeded RNG for reproducible local games, AI, and verification replays. */
export function createSeededRng(seed: number): () => number {
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
    generateCoordinateSet(config.maxPip),
    seededRandom(seed)
  );
  const captains = [
    ...config.humanCaptains.map((human) => ({
      id: human.id,
      displayName: human.displayName,
    })),
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
      houseRules: config.houseRules,
      objective: config.objective,
      campaignRounds: config.campaignRounds,
      maxPip: config.maxPip,
    },
    {
      shuffledCoordinates: shuffled,
      roundStarterId: config.humanCaptains[0]?.id ?? config.humanId,
    }
  );
}

function applyDevRoundModules(
  state: GameState,
  round: NonNullable<GameState['round']>,
  spacedockPlacedBy: string
): NonNullable<GameState['round']> {
  let next = round;

  if (state.modules.warpDriveSpool.enabled) {
    next = {
      ...next,
      hazardMarkerHolder: spacedockPlacedBy,
      hazardMarkerPassCount: 0,
    };
  }

  if (state.modules.temporalDebt.enabled) {
    const debtTokens: Record<string, number> = {};
    for (const captain of state.captains) {
      debtTokens[captain.id] = 0;
    }
    next = { ...next, debtTokens };
  }

  return next;
}

/**
 * Dev console: redeal the *current* round with a fresh shuffle seed.
 * Preserves campaign scores, round number, turn order, and squadrons.
 */
export function redealLocalRoundWithSeed(
  state: GameState,
  seed: number
): GameState {
  if (state.phase !== 'active' || !state.round) {
    throw new Error('No active round to redeal');
  }

  const round = state.round;
  const maxPip = state.maxPip ?? 12;
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(maxPip),
    seededRandom(seed)
  );
  const roundStarterId = round.table.spacedock.placedBy;

  if (state.modules.drafting.enabled) {
    const draftRound = createRoundStateWithDraft({
      roundNumber: round.roundNumber,
      captains: state.captains,
      shuffledCoordinates: shuffled,
      turnOrder: round.turnOrder,
      roundStarterId,
      maxPip,
      largeFleetHandSize: state.houseRules.largeFleetHandSize,
      packSize: state.modules.drafting.packSize,
      squadrons: round.squadrons,
    });
    return {
      ...state,
      round: applyDevRoundModules(state, draftRound, roundStarterId),
    };
  }

  const deal = dealRoundFromShuffled({
    roundNumber: round.roundNumber,
    captains: state.captains,
    shuffledCoordinates: shuffled,
    turnOrder: round.turnOrder,
    roundStarterId,
    largeFleetHandSize: state.houseRules.largeFleetHandSize,
    maxPip,
  });
  const baseRound = createRoundStateFromDeal(deal, round.squadrons);

  return {
    ...state,
    round: applyDevRoundModules(state, baseRound, deal.spacedockPlacedBy),
  };
}

function usesOmegaNet(ai: AiCaptainConfig): boolean {
  return ai.skill === 'commander' || ai.omega === true;
}

function usesOmegaSearch(ai: AiCaptainConfig): boolean {
  return usesOmegaNet(ai) && ai.extendedThinking === true;
}

/** Commander (commander) — and legacy `omega: true` — load neural Ω weights. */
export function rosterNeedsOmegaNet(
  aiCaptains: readonly AiCaptainConfig[]
): boolean {
  return aiCaptains.some((ai) => usesOmegaNet(ai));
}

export function buildAiRosterFromConfigs(
  aiCaptains: readonly AiCaptainConfig[],
  objective: GameObjective,
  seed: number,
  playerCount = aiCaptains.length + 1,
  omegaNet?: OmegaModelWeights,
  maxPip = 12
): ReadonlyMap<string, WarpAiPlayer> {
  const allowOmega = neuralAiSupported(maxPip);
  if (allowOmega && rosterNeedsOmegaNet(aiCaptains) && !omegaNet) {
    throw new Error(
      'Commander (Ω) officers require loaded model weights — call buildAiRosterFromConfigsAsync.'
    );
  }

  const roster = new Map<string, WarpAiPlayer>();
  for (const [index, ai] of aiCaptains.entries()) {
    const rng = createSeededRng(seed + (index + 1) * 997);
    const skill = getWarpSkillProfile(ai.skill, objective, playerCount);
    const useOmega = allowOmega && usesOmegaNet(ai);
    const useSearch = useOmega && usesOmegaSearch(ai);

    roster.set(
      ai.id,
      useSearch
        ? createOmegaSearchPlayer({ net: omegaNet!, rng })
        : useOmega
          ? createOmegaPlayer({ net: omegaNet!, rng })
          : createWarpAiPlayer({
              // No shipped weights for this factor yet — Commander = commander heuristics.
              skill,
              objective,
              rng,
            })
    );
  }
  return roster;
}

export async function buildAiRosterFromConfigsAsync(
  aiCaptains: readonly AiCaptainConfig[],
  objective: GameObjective,
  seed: number,
  playerCount = aiCaptains.length + 1,
  maxPip = 12
): Promise<ReadonlyMap<string, WarpAiPlayer>> {
  const omegaNet =
    neuralAiSupported(maxPip) && rosterNeedsOmegaNet(aiCaptains)
      ? await preloadOmegaWeights(objective)
      : undefined;
  return buildAiRosterFromConfigs(
    aiCaptains,
    objective,
    seed,
    playerCount,
    omegaNet,
    maxPip
  );
}

export function buildAiRoster(
  config: LocalGameConfig,
  seed: number,
  omegaNet?: OmegaModelWeights
): ReadonlyMap<string, WarpAiPlayer> {
  return buildAiRosterFromConfigs(
    config.aiCaptains,
    config.objective,
    seed,
    config.playerCount,
    omegaNet,
    config.maxPip
  );
}

export async function buildAiRosterAsync(
  config: LocalGameConfig,
  seed: number
): Promise<ReadonlyMap<string, WarpAiPlayer>> {
  return buildAiRosterFromConfigsAsync(
    config.aiCaptains,
    config.objective,
    seed,
    config.playerCount,
    config.maxPip
  );
}
