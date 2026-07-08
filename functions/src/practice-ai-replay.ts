import type {
  GameAction,
  GameModuleConfig,
  GameObjective,
  GameState,
  HouseRulesConfig,
  WarpAiPlayer,
  WarpSkillLevel,
} from 'warp12-engine';

export interface SerializableLocalGameConfig {
  humanId: string;
  humanName: string;
  playerCount: number;
  objective: GameObjective;
  campaignRounds: number;
  modules: GameModuleConfig;
  houseRules?: HouseRulesConfig;
  aiCaptains: readonly {
    id: string;
    displayName: string;
    skill: WarpSkillLevel;
    class1Star?: boolean;
    extendedThinking?: boolean;
    poolId?: string;
  }[];
  rulesProfileId?: string;
}

export type LocalAiReplayResult =
  | { ok: true; humanWon: boolean; steps: number }
  | { ok: false; violation: string; steps: number };

const MAX_REPLAY_STEPS = 50_000;
const MAX_HUMAN_ACTIONS = 4_000;

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

function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function createMatchRoundReshuffle(seed: number): () => number {
  return mulberry32((seed ^ 0x9e3779b9) >>> 0);
}

function humanWonLocalMatch(game: GameState, humanId: string): boolean {
  if (game.phase !== 'complete') {
    return false;
  }
  if (game.objective === 'go-out') {
    return game.round?.roundWinnerId === humanId;
  }
  let winner = game.captains[0];
  for (const captain of game.captains) {
    if (captain.pointsScore < winner.pointsScore) {
      winner = captain;
    }
  }
  return winner.id === humanId;
}

function roundAwaitingScore(state: GameState): boolean {
  const round = state.round;
  return (
    state.phase === 'active' &&
    round?.phase === 'ended' &&
    Boolean(round.roundWinnerId || round.roundBlocked)
  );
}

function validateConfig(config: SerializableLocalGameConfig): string | null {
  if (config.playerCount < 2 || config.playerCount > 8) {
    return 'INVALID_PLAYER_COUNT';
  }
  if (config.aiCaptains.some((ai) => ai.class1Star)) {
    return 'CLASS1_STAR_NOT_VERIFIED';
  }
  if (config.aiCaptains.some((ai) => ai.extendedThinking)) {
    return 'EXTENDED_THINKING_NOT_VERIFIED';
  }
  if (config.humanId.length === 0 || config.aiCaptains.length === 0) {
    return 'INVALID_CONFIG';
  }
  return null;
}

export async function replayLocalAiHumanActions(input: {
  config: SerializableLocalGameConfig;
  seed: number;
  humanActions: readonly GameAction[];
}): Promise<LocalAiReplayResult> {
  const configError = validateConfig(input.config);
  if (configError) {
    return { ok: false, violation: configError, steps: 0 };
  }
  if (input.humanActions.length > MAX_HUMAN_ACTIONS) {
    return { ok: false, violation: 'HUMAN_ACTIONS_TOO_LONG', steps: 0 };
  }
  if (!Number.isFinite(input.seed)) {
    return { ok: false, violation: 'INVALID_SEED', steps: 0 };
  }

  const humanQueue = input.humanActions.filter(
    (action) => action.type !== 'END_ROUND'
  );
  if (humanQueue.length === 0) {
    return { ok: false, violation: 'NO_HUMAN_ACTIONS', steps: 0 };
  }

  const engine = await import('warp12-engine');
  const {
    applyAction,
    scoreRound,
    createOmegaPlayer,
    createWarpAiPlayer,
    generateCoordinateSet,
    getWarpSkillProfile,
    resolveClass1StarPlayLookahead,
    shuffleCoordinates,
    startGame,
    validateOmegaModelWeights,
  } = engine;

  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');

  function loadOmegaNet(objective: GameObjective) {
    const file =
      objective === 'go-out' ? 'omega-goout-v1.json' : 'omega-v1.json';
    // Deployed next to the Functions package root (see prepare-functions-packages.sh).
    const path = resolve(process.cwd(), 'models', file);
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    validateOmegaModelWeights(raw);
    return raw;
  }

  const config = input.config;
  const shuffled = shuffleCoordinates(
    generateCoordinateSet(12),
    seededRandom(input.seed)
  );
  const captains = [
    { id: config.humanId, displayName: config.humanName },
    ...config.aiCaptains.map((ai) => ({
      id: ai.id,
      displayName: ai.displayName,
    })),
  ];

  let state = startGame(
    {
      id: `local-${input.seed}`,
      captains,
      modules: config.modules,
      houseRules: config.houseRules,
      objective: config.objective,
      campaignRounds: config.campaignRounds,
    },
    { shuffledCoordinates: shuffled, roundStarterId: config.humanId }
  );

  const needsOmega = config.aiCaptains.some(
    (ai) => ai.skill === 'commander'
  );
  const omegaNet = needsOmega ? loadOmegaNet(config.objective) : null;

  const roster = new Map<string, WarpAiPlayer>();
  for (const [index, ai] of config.aiCaptains.entries()) {
    const rng = mulberry32(input.seed + (index + 1) * 997);
    const skill = getWarpSkillProfile(
      ai.skill,
      config.objective,
      config.playerCount
    );
    if (ai.class1Star) {
      roster.set(
        ai.id,
        createWarpAiPlayer({
          skill,
          objective: config.objective,
          lookahead: resolveClass1StarPlayLookahead(
            config.objective,
            config.playerCount
          ),
          rng,
        })
      );
    } else if (ai.skill === 'commander') {
      if (!omegaNet) {
        return { ok: false, violation: 'OMEGA_WEIGHTS_MISSING', steps: 0 };
      }
      roster.set(ai.id, createOmegaPlayer({ net: omegaNet, rng }));
    } else {
      roster.set(
        ai.id,
        createWarpAiPlayer({
          skill,
          objective: config.objective,
          rng,
        })
      );
    }
  }

  const roundReshuffle = createMatchRoundReshuffle(input.seed);
  let steps = 0;

  const applyMatchAction = (
    current: GameState,
    action: GameAction
  ): ReturnType<typeof applyAction> => {
    if (action.type !== 'END_ROUND') {
      return applyAction(current, action);
    }
    if (current.phase !== 'active' || !current.round) {
      return { ok: false, violation: 'GAME_NOT_ACTIVE' };
    }
    const round = current.round;
    if (round.phase !== 'ended') {
      return { ok: false, violation: 'ROUND_NOT_PLAYING' };
    }
    if (round.roundBlocked) {
      if (action.winnerId !== null) {
        return { ok: false, violation: 'ROUND_NOT_PLAYING' };
      }
      return scoreRound(current, round, roundReshuffle);
    }
    if (round.roundWinnerId !== action.winnerId) {
      return { ok: false, violation: 'ROUND_NOT_PLAYING' };
    }
    return scoreRound(current, round, roundReshuffle);
  };

  const pickAiAction = (
    ai: WarpAiPlayer,
    current: GameState,
    playerId: string
  ): GameAction | null => {
    const scratch = structuredClone(current);
    const offTurn = ai.decideOffTurnGameAction(scratch, playerId);
    if (offTurn) {
      return offTurn;
    }
    if (
      scratch.round?.phase !== 'playing' ||
      scratch.round.activePlayerId !== playerId
    ) {
      return null;
    }
    return ai.decideGameAction(structuredClone(current), playerId);
  };

  while (state.phase !== 'complete' && steps < MAX_REPLAY_STEPS) {
    if (roundAwaitingScore(state)) {
      const round = state.round!;
      const action: GameAction = {
        type: 'END_ROUND',
        winnerId: round.roundBlocked ? null : round.roundWinnerId!,
      };
      const result = applyMatchAction(state, action);
      steps += 1;
      if (!result.ok) {
        return { ok: false, violation: result.violation, steps };
      }
      state = result.state;
      continue;
    }

    const round = state.round;
    if (!round || round.phase !== 'playing') {
      return { ok: false, violation: 'STALE_GAME_STATE', steps };
    }

    const activeId = round.activePlayerId;

    if (activeId === config.humanId) {
      const next = humanQueue.shift();
      if (!next) {
        return { ok: false, violation: 'HUMAN_ACTIONS_EXHAUSTED', steps };
      }
      const result = applyMatchAction(state, next);
      steps += 1;
      if (!result.ok) {
        return { ok: false, violation: result.violation, steps };
      }
      state = result.state;
      continue;
    }

    const ai = roster.get(activeId);
    if (!ai) {
      return { ok: false, violation: 'UNKNOWN_ACTIVE_PLAYER', steps };
    }

    const action = pickAiAction(ai, state, activeId);
    if (!action) {
      return { ok: false, violation: 'AI_NO_ACTION', steps };
    }
    const result = applyMatchAction(state, action);
    steps += 1;
    if (!result.ok) {
      return { ok: false, violation: result.violation, steps };
    }
    state = result.state;
  }

  if (state.phase !== 'complete') {
    return { ok: false, violation: 'MATCH_INCOMPLETE', steps };
  }
  if (humanQueue.length > 0) {
    return { ok: false, violation: 'EXTRA_HUMAN_ACTIONS', steps };
  }

  return {
    ok: true,
    humanWon: humanWonLocalMatch(state, config.humanId),
    steps,
  };
}

// Re-export for type checking in handlers
export type { GameAction };
