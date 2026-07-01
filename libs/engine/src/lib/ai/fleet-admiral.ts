import type { GameObjective } from '../types/objective.js';
import type { LookaheadOptions } from './lookahead-options.js';

/** Experimental deep-search preset — local / bench only, not a TEI tier. */
export interface FleetAdmiralSearchProfile {
  readonly label: 'fleet-admiral';
  readonly lookahead: LookaheadOptions;
}

export type FleetAdmiralPlayMode = 'bench' | 'interactive';

/**
 * ISMCTS-only preset — A/B benches and advisor deep-think comparisons.
 * Not the default Class I* play backend in 2p (see {@link resolveFleetAdmiralPlayLookahead}).
 */
export function resolveFleetAdmiralIsmctsLookahead(
  objective: GameObjective,
  playerCount: number
): LookaheadOptions {
  const base = {
    searchEngine: 'ismcts' as const,
    useBeliefConstraints: true,
    maxBranch: 8,
  };

  if (playerCount >= 3) {
    return {
      ...base,
      timeBudgetMs: 300,
      ismctsMaxIterations: 2_000,
      ismctsRolloutDepth: 16,
      maxBranch: 6,
    };
  }

  if (objective === 'points') {
    return {
      ...base,
      timeBudgetMs: 500,
      ismctsMaxIterations: 4_000,
      ismctsRolloutDepth: 24,
    };
  }

  return {
    ...base,
    timeBudgetMs: 400,
    ismctsMaxIterations: 3_000,
    ismctsRolloutDepth: 20,
  };
}

/** Expectimax-only preset — A/B benches and documented 2p edge vs Commander. */
export function resolveFleetAdmiralExpectimaxLookahead(
  objective: GameObjective,
  playerCount: number
): LookaheadOptions {
  if (playerCount >= 3) {
    return {
      depth: 2,
      determinizations: 10,
      maxBranch: 6,
      useBeliefConstraints: true,
      searchEngine: 'expectimax',
    };
  }

  if (objective === 'points') {
    return {
      depth: 4,
      determinizations: 16,
      maxBranch: 8,
      useBeliefConstraints: true,
      searchEngine: 'expectimax',
    };
  }

  return {
    depth: 3,
    determinizations: 12,
    maxBranch: 8,
    useBeliefConstraints: true,
    searchEngine: 'expectimax',
  };
}

function resolveInteractiveExpectimaxLookahead(
  objective: GameObjective
): LookaheadOptions {
  if (objective === 'points') {
    return {
      depth: 4,
      determinizations: 12,
      maxBranch: 8,
      useBeliefConstraints: true,
      searchEngine: 'expectimax',
    };
  }

  return {
    depth: 3,
    determinizations: 10,
    maxBranch: 8,
    useBeliefConstraints: true,
    searchEngine: 'expectimax',
  };
}

function resolveInteractiveIsmctsLookahead(
  objective: GameObjective,
  playerCount: number
): LookaheadOptions {
  const base = {
    searchEngine: 'ismcts' as const,
    useBeliefConstraints: true,
    maxBranch: 8,
    timeBudgetMs: 250,
    ismctsRolloutDepth: 20,
  };

  if (playerCount >= 3) {
    return {
      ...base,
      maxBranch: 6,
      ismctsMaxIterations: 800,
      ismctsRolloutDepth: 16,
    };
  }

  if (objective === 'points') {
    return {
      ...base,
      ismctsMaxIterations: 1_200,
      ismctsRolloutDepth: 22,
    };
  }

  return {
    ...base,
    ismctsMaxIterations: 1_000,
    ismctsRolloutDepth: 18,
  };
}

/**
 * Multi-engine play routing — the production Class I* / Fleet Admiral backend.
 *
 * - **2 players:** expectimax (64% vs Commander in 2p points at bench depth)
 * - **3+ players:** ISMCTS (scales; expectimax blows up in N)
 */
export function resolveFleetAdmiralPlayLookahead(
  objective: GameObjective,
  playerCount: number,
  mode: FleetAdmiralPlayMode = 'bench'
): LookaheadOptions {
  if (playerCount >= 3) {
    return mode === 'interactive'
      ? resolveInteractiveIsmctsLookahead(objective, playerCount)
      : resolveFleetAdmiralIsmctsLookahead(objective, playerCount);
  }

  return mode === 'interactive'
    ? resolveInteractiveExpectimaxLookahead(objective)
    : resolveFleetAdmiralExpectimaxLookahead(objective, playerCount);
}

/**
 * Default Fleet Admiral / bench play preset — multi-engine routing.
 * @deprecated alias — prefer {@link resolveFleetAdmiralPlayLookahead}.
 */
export function resolveFleetAdmiralLookahead(
  objective: GameObjective,
  playerCount: number
): LookaheadOptions {
  return resolveFleetAdmiralPlayLookahead(objective, playerCount, 'bench');
}

/** Advisor / coach "deep think" — time-boxed ISMCTS; coach explanations stay heuristic. */
export function resolveDeepThinkAdvisorLookahead(): LookaheadOptions {
  return {
    searchEngine: 'ismcts',
    useBeliefConstraints: true,
    maxBranch: 8,
    timeBudgetMs: 250,
    ismctsMaxIterations: 800,
    ismctsRolloutDepth: 16,
  };
}

export function fleetAdmiralProfile(
  objective: GameObjective,
  playerCount: number
): FleetAdmiralSearchProfile {
  return {
    label: 'fleet-admiral',
    lookahead: resolveFleetAdmiralPlayLookahead(objective, playerCount, 'bench'),
  };
}

/** Class I* local opponent — interactive budgets on the multi-engine stack. */
export function resolveClass1StarPlayLookahead(
  objective: GameObjective,
  playerCount: number
): LookaheadOptions {
  return resolveFleetAdmiralPlayLookahead(
    objective,
    playerCount,
    'interactive'
  );
}
