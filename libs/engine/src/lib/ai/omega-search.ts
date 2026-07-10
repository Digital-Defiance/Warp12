import type { PlayerRef, Rng, SearchModel } from 'double-eighteen';

import type { GameState } from '../types/game-state.js';
import type { GameObjective } from '../types/objective.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';
import { buildWarpContext } from './context.js';
import { warpAiActionKey } from './from-game-action.js';
import { ismctsSearchActionValues } from './ismcts.js';
import { encodeOmegaPolicyFeatures, encodeOmegaStateFeatures } from './omega-encoder.js';
import {
  forwardOmegaPolicyLogit,
  forwardOmegaValue,
  softmax,
  type OmegaModelWeights,
} from './omega-net.js';
import { observe, type WarpAiObservation } from './observation.js';
import {
  createWarpSearchModel,
  handPips,
  handTileCount,
  observationToState,
  type WarpSearchModelOptions,
} from './search-model.js';

const STILL_RNG: Rng = () => 0.5;

/**
 * Graded rank reward in [-1, 1] for `perspective` at a scored round leaf — best
 * seat +1, worst -1. Matches the collector's per-round training reward so search
 * backups and training labels live on the same scale.
 */
function terminalRankReward(
  state: GameState,
  perspective: PlayerId
): number {
  const round = state.round;
  if (!round) return 0;
  const ids = round.turnOrder;
  const n = ids.length;
  if (n <= 1) return 0;

  const score = (id: PlayerId): number =>
    state.objective === 'go-out'
      ? handTileCount(round.hands[id] ?? [])
      : handPips(round.hands[id] ?? [], state.modules, round.roundNumber);

  const mine = score(perspective);
  let better = 0;
  let ties = 0;
  for (const id of ids) {
    const s = score(id);
    if (s < mine) better++;
    else if (s === mine && id !== perspective) ties++;
  }
  const avgRank = better + 1 + ties / 2;
  return 1 - (2 * (avgRank - 1)) / (n - 1);
}

/**
 * SearchModel with Omega value-head leaves — Commander-free evaluation.
 * Terminal (ended-round) leaves use exact per-round rank reward.
 */
export function createOmegaSearchModel(
  objective: GameObjective,
  net: OmegaModelWeights,
  modelOptions: WarpSearchModelOptions = {}
): SearchModel<GameState, WarpAiAction> {
  const base = createWarpSearchModel(objective, modelOptions);
  return {
    ...base,
    evaluate(state: GameState, perspective: PlayerRef): number {
      const round = state.round;
      if (!round) return 0;
      const seat = perspective as PlayerId;
      if (round.phase === 'ended') {
        return terminalRankReward(state, seat);
      }
      const obs = observe(state, seat);
      if (!obs) return 0;
      const ctx = buildWarpContext(obs, STILL_RNG);
      return forwardOmegaValue(encodeOmegaStateFeatures(ctx), net);
    },
  };
}

export interface OmegaSearchOptions {
  /** ISMCTS iterations per decision (visit budget). */
  readonly iterations: number;
  readonly rng: Rng;
  readonly maxBranch?: number;
  /** PUCT / UCT exploration constant. Defaults to 1.5 for PUCT, √2 for UCT. */
  readonly explorationConstant?: number;
  readonly useBeliefConstraints?: boolean;
  /** Wall-clock cap; defaults high so `iterations` is the real limit. */
  readonly timeBudgetMs?: number;
  /**
   * Leaf / expansion mode:
   * - `'puct'` (default): Omega policy prior + Omega value leaves — Commander-free.
   *   Strength that can improve with more iterations once the value head is competent.
   * - `'heuristic'`: Commander-ordered rollouts + classic UCT. Training bootstrap only;
   *   not the product path for Ω+.
   * - `'value'`: Omega value leaves with classic UCT (no policy prior). A/B only.
   */
  readonly leaf?: 'puct' | 'heuristic' | 'value';
  /** Softmax temperature for the policy prior (default 1). */
  readonly priorTemperature?: number;
  /** Rollout depth for heuristic leaf mode (default 24). Ignored by puct/value. */
  readonly rolloutDepth?: number;
}

export interface OmegaSearchVisit {
  readonly action: WarpAiAction;
  readonly visits: number;
  readonly value: number;
}

/**
 * Omega policy priors P(a|s) for a state / action list — used as PUCT priors.
 * Uses the active seat's observation of `state` (determinized worlds included).
 */
export function omegaActionPriors(
  state: GameState,
  actions: readonly WarpAiAction[],
  net: OmegaModelWeights,
  temperature = 1
): number[] {
  if (actions.length === 0) return [];
  const round = state.round;
  if (!round) {
    return Array.from({ length: actions.length }, () => 1 / actions.length);
  }
  const obs = observe(state, round.activePlayerId);
  if (!obs) {
    return Array.from({ length: actions.length }, () => 1 / actions.length);
  }
  const ctx = buildWarpContext(obs, STILL_RNG);
  const logits = actions.map((action) =>
    forwardOmegaPolicyLogit(encodeOmegaPolicyFeatures(ctx, action), net)
  );
  return [...softmax(logits, temperature)];
}

/**
 * Run search from an observation and return per-candidate visit counts.
 *
 * Default (`leaf: 'puct'`) is Commander-free: Omega policy prior + value leaves.
 * Heuristic leaf remains available for training bootstrap / A/B.
 */
export function omegaSearchVisits(
  obs: WarpAiObservation,
  net: OmegaModelWeights,
  options: OmegaSearchOptions
): OmegaSearchVisit[] {
  const leaf = options.leaf ?? 'puct';
  const modelOptions: WarpSearchModelOptions = {
    useBeliefConstraints: options.useBeliefConstraints ?? true,
  };
  const model =
    leaf === 'heuristic'
      ? createWarpSearchModel(obs.objective, modelOptions)
      : createOmegaSearchModel(obs.objective, net, modelOptions);

  const usePuct = leaf === 'puct';
  const scored = ismctsSearchActionValues<GameState, WarpAiAction>(
    observationToState(obs),
    model,
    {
      perspective: obs.playerId,
      rng: options.rng,
      maxIterations: options.iterations,
      timeBudgetMs: options.timeBudgetMs ?? 60_000,
      maxBranch: options.maxBranch ?? 8,
      explorationConstant: options.explorationConstant,
      rolloutDepth:
        leaf === 'heuristic' ? (options.rolloutDepth ?? 24) : 0,
      rolloutPolicy: leaf === 'heuristic' ? 'heuristic' : 'prior',
      ...(usePuct
        ? {
            actionPrior: (state, actions) =>
              omegaActionPriors(
                state as GameState,
                actions,
                net,
                options.priorTemperature ?? 1
              ),
          }
        : {}),
    },
    warpAiActionKey
  );
  return scored.map((entry) => ({
    action: entry.action,
    visits: entry.visits,
    value: entry.value,
  }));
}
