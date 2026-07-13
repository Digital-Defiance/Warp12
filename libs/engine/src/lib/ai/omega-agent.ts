import type { Rng } from 'double-eighteen';

import type { GameAction } from '../types/actions.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import {
  warpCandidateGenerator,
  warpOffTurnCandidateGenerator,
} from './candidate-generator.js';
import { buildWarpContext } from './context.js';
import { encodeOmegaPolicyFeatures } from './omega-encoder.js';
import {
  forwardOmegaPolicyLogit,
  softmax,
  type OmegaModelWeights,
} from './omega-net.js';
import { observe, type WarpAiObservation } from './observation.js';
import type { WarpAiPlayer } from './create-warp-ai.js';

export interface CreateOmegaPlayerOptions {
  /** Trained (or zero-init) Ω weights. */
  net: OmegaModelWeights;
  /** Seeded RNG for reproducible sampling. Defaults to `Math.random`. */
  rng?: Rng;
  /**
   * Softmax temperature over policy logits.
   * - `0` (default): greedy argmax — use for play and benchmarking.
   * - `> 0`: sample proportionally — use for self-play exploration.
   */
  temperature?: number;
}

/** Fallback when no candidates are generated (mirror of the heuristic path). */
function fallbackAction(obs: WarpAiObservation): WarpAiAction {
  if (canDrawFromUncharted(obs.round, obs.playerId, obs.houseRules)) {
    return { kind: 'draw' };
  }
  if (canPassRedAlert(obs.round, obs.playerId, { houseRules: obs.houseRules })) {
    return { kind: 'pass-red-alert' };
  }
  if (
    canDeployDistressBeacon(obs.round, obs.playerId, {
      houseRules: obs.houseRules,
    })
  ) {
    return { kind: 'deploy-beacon' };
  }
  if (canPassTurn(obs.round, obs.playerId, { houseRules: obs.houseRules })) {
    return { kind: 'pass-turn' };
  }
  return { kind: 'deploy-beacon' };
}

function sampleIndex(probabilities: readonly number[], rng: Rng): number {
  const roll = rng();
  let cumulative = 0;
  for (let i = 0; i < probabilities.length; i++) {
    cumulative += probabilities[i];
    if (roll <= cumulative) {
      return i;
    }
  }
  return probabilities.length - 1;
}

function argmaxIndex(values: readonly number[]): number {
  let best = 0;
  let bestValue = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > bestValue) {
      bestValue = values[i];
      best = i;
    }
  }
  return best;
}

/**
 * Standalone Ω opponent — chooses actions purely from the learned policy
 * network. No heuristics, no Commander, no search. It plays to win and does not
 * explain itself; the coach/advisor path is unaffected and stays heuristic.
 */
export function createOmegaPlayer(
  options: CreateOmegaPlayerOptions
): WarpAiPlayer {
  const rng = options.rng ?? Math.random;
  const temperature = options.temperature ?? 0;
  const net = options.net;

  const pickFromCandidates = (
    obs: WarpAiObservation,
    candidates: readonly WarpAiAction[]
  ): WarpAiAction => {
    if (candidates.length === 1) {
      return candidates[0];
    }
    const ctx = buildWarpContext(obs, rng);
    const logits = candidates.map((action) =>
      forwardOmegaPolicyLogit(encodeOmegaPolicyFeatures(ctx, action), net)
    );
    if (temperature <= 0) {
      return candidates[argmaxIndex(logits)];
    }
    const probabilities = softmax(logits, temperature);
    return candidates[sampleIndex(probabilities, rng)];
  };

  const decide = (obs: WarpAiObservation): WarpAiAction => {
    const candidates = warpCandidateGenerator(obs, { rng });
    if (candidates.length === 0) {
      return fallbackAction(obs);
    }
    return pickFromCandidates(obs, candidates);
  };

  const decideOffTurn = (obs: WarpAiObservation): WarpAiAction | null => {
    const offTurn = warpOffTurnCandidateGenerator(obs);
    if (offTurn.length === 0) {
      return null;
    }
    return offTurn.length === 1 ? offTurn[0] : pickFromCandidates(obs, offTurn);
  };

  return {
    decide,
    async decideAsync(obs) {
      await Promise.resolve();
      return decide(obs);
    },
    decideGameAction(state: GameState, playerId: PlayerId): GameAction | null {
      const obs = observe(state, playerId);
      if (!obs) return null;
      return toGameAction(decide(obs), playerId);
    },
    async decideGameActionAsync(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      return toGameAction(decide(obs), playerId);
    },
    decideOffTurnGameAction(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      const action = decideOffTurn(obs);
      return action ? toGameAction(action, playerId) : null;
    },
    async decideOffTurnGameActionAsync(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      const action = decideOffTurn(obs);
      return action ? toGameAction(action, playerId) : null;
    },
  };
}
