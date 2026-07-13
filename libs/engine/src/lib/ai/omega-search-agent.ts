import type { Rng } from 'double-eighteen';

import type { GameAction } from '../types/actions.js';
import type { GameState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import {
  warpCandidateGenerator,
  warpOffTurnCandidateGenerator,
} from './candidate-generator.js';
import { buildWarpContext } from './context.js';
import { encodeOmegaPolicyFeatures } from './omega-encoder.js';
import { forwardOmegaPolicyLogit, type OmegaModelWeights } from './omega-net.js';
import { omegaSearchVisits, type OmegaSearchVisit } from './omega-search.js';
import { observe, type WarpAiObservation } from './observation.js';
import type { WarpAiPlayer } from './create-warp-ai.js';

export interface CreateOmegaSearchPlayerOptions {
  /** Trained Ω weights (same net as greedy `createOmegaPlayer`). */
  net: OmegaModelWeights;
  /** Seeded RNG for reproducible search/sampling. Defaults to `Math.random`. */
  rng?: Rng;
  /**
   * ISMCTS iterations per on-turn decision. Default 480.
   * BENCHED (go-out 4p vs greedy Ω): PUCT @ 480 ≈ 1.3× fair share (Commander-free);
   * more iterations currently *hurt* until the value head is retrained (Path A) —
   * the leaf still degrades under deeper search. Do not raise default for "better"
   * until Path A lifts the value leaf.
   */
  iterations?: number;
  /** Wall-clock cap per decision; defaults high so `iterations` is the limit. */
  timeBudgetMs?: number;
  /** Cap candidate moves expanded per node. Default 8. */
  maxBranch?: number;
  /**
   * Search mode (default `'puct'` — Commander-free):
   * - `'puct'`: Omega policy prior + Omega value leaves. Product Ω+.
   * - `'heuristic'`: Commander rollouts + UCT — training bootstrap / A/B only.
   * - `'value'`: Omega value leaves + UCT (no policy prior) — A/B only.
   */
  leaf?: 'puct' | 'heuristic' | 'value';
  /** Softmax temperature for the policy prior (PUCT). Default 1. */
  priorTemperature?: number;
  /** Rollout depth for heuristic leaf mode (default 24). */
  rolloutDepth?: number;
  /**
   * Selection temperature over visit counts.
   * - `0` (default): argmax visits — strongest, deterministic play.
   * - `> 0`: sample proportional to visits^(1/T) — variety for exhibition.
   */
  temperature?: number;
}

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

function sampleIndex(weights: readonly number[], rng: Rng): number {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) return 0;
  const roll = rng() * total;
  let cumulative = 0;
  for (let i = 0; i < weights.length; i++) {
    cumulative += weights[i];
    if (roll <= cumulative) return i;
  }
  return weights.length - 1;
}

function argmaxVisit(visits: readonly OmegaSearchVisit[]): WarpAiAction {
  let best = visits[0];
  for (const entry of visits) {
    if (entry.visits > best.visits) best = entry;
  }
  return best.action;
}

/**
 * Ω+ ("extended thinking") — same Ω weights as {@link createOmegaPlayer},
 * but on-turn decisions run **Commander-free** net-guided ISMCTS (PUCT with
 * Omega policy prior + value leaves) and play the most-visited move. Unrated
 * exhibition / hard mode. Off-turn and single-candidate turns use the fast
 * policy path.
 */
export function createOmegaSearchPlayer(
  options: CreateOmegaSearchPlayerOptions
): WarpAiPlayer {
  const rng = options.rng ?? Math.random;
  const net = options.net;
  const iterations = options.iterations ?? 480;
  const temperature = options.temperature ?? 0;
  const leaf = options.leaf ?? 'puct';

  const policyPick = (
    obs: WarpAiObservation,
    candidates: readonly WarpAiAction[]
  ): WarpAiAction => {
    if (candidates.length === 1) return candidates[0];
    const ctx = buildWarpContext(obs, rng);
    let bestIndex = 0;
    let bestLogit = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < candidates.length; i++) {
      const logit = forwardOmegaPolicyLogit(
        encodeOmegaPolicyFeatures(ctx, candidates[i]),
        net
      );
      if (logit > bestLogit) {
        bestLogit = logit;
        bestIndex = i;
      }
    }
    return candidates[bestIndex];
  };

  const decide = (obs: WarpAiObservation): WarpAiAction => {
    const candidates = warpCandidateGenerator(obs, { rng });
    if (candidates.length === 0) return fallbackAction(obs);
    if (candidates.length === 1) return candidates[0];

    const visits = omegaSearchVisits(obs, net, {
      iterations,
      rng,
      maxBranch: options.maxBranch ?? 8,
      timeBudgetMs: options.timeBudgetMs,
      leaf,
      priorTemperature: options.priorTemperature,
      rolloutDepth: options.rolloutDepth,
      useBeliefConstraints: true,
    });
    if (visits.length === 0) return policyPick(obs, candidates);
    if (temperature <= 0) return argmaxVisit(visits);

    const weights = visits.map((v) => Math.pow(v.visits, 1 / temperature));
    return visits[sampleIndex(weights, rng)].action;
  };

  const decideOffTurn = (obs: WarpAiObservation): WarpAiAction | null => {
    const offTurn = warpOffTurnCandidateGenerator(obs);
    if (offTurn.length === 0) return null;
    return offTurn.length === 1 ? offTurn[0] : policyPick(obs, offTurn);
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
