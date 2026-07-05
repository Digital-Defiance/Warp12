import type { PlayerRef, Rng, SearchModel } from 'doubletwelve';

import type { GameState } from '../types/game-state.js';
import type { GameObjective } from '../types/objective.js';
import type { PlayerId } from '../types/player.js';
import type { WarpAiAction } from './actions.js';
import { buildWarpContext } from './context.js';
import { warpAiActionKey } from './from-game-action.js';
import { ismctsSearchActionValues } from './ismcts.js';
import { encodeOmegaStateFeatures } from './omega-encoder.js';
import { forwardOmegaValue, type OmegaModelWeights } from './omega-net.js';
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
  // Competition rank: how many seats strictly better (lower score) + tie handling.
  let better = 0;
  let ties = 0;
  for (const id of ids) {
    const s = score(id);
    if (s < mine) better++;
    else if (s === mine && id !== perspective) ties++;
  }
  const avgRank = better + 1 + ties / 2; // 1-based, tie-averaged
  return 1 - (2 * (avgRank - 1)) / (n - 1);
}

/**
 * A {@link SearchModel} whose leaf evaluation is the **Omega value head** rather
 * than Commander-heuristic rollouts — keeping the search Commander-free. Terminal
 * (scored-round) leaves use the exact per-round rank reward; interior leaves use
 * the learned value estimate from `perspective`'s observation.
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
  readonly explorationConstant?: number;
  readonly useBeliefConstraints?: boolean;
  /** Wall-clock cap; defaults high so `iterations` is the real limit. */
  readonly timeBudgetMs?: number;
  /**
   * Leaf signal:
   * - `'heuristic'` (default): Commander-ordered rollouts + heuristic leaf eval.
   *   Produces sharp, informative visit targets even before the net is strong —
   *   the net distills *search-improved* play (which can exceed greedy Commander),
   *   not Commander's raw picks. Commander is a rollout simulator only; it never
   *   appears at inference.
   * - `'value'`: value-net leaf eval, no rollout (pure, Commander-free). Requires
   *   an already-competent value head to concentrate — use once bootstrapped.
   */
  readonly leaf?: 'heuristic' | 'value';
  /** Rollout depth for heuristic leaf mode (default 24). */
  readonly rolloutDepth?: number;
}

export interface OmegaSearchVisit {
  readonly action: WarpAiAction;
  readonly visits: number;
  readonly value: number;
}

/**
 * Run value-net-guided ISMCTS from an observation and return per-candidate visit
 * counts — the AlphaZero-style improved policy target. `rolloutDepth: 0` means
 * each simulation evaluates the leaf directly with the value head (no rollout,
 * no heuristics).
 */
export function omegaSearchVisits(
  obs: WarpAiObservation,
  net: OmegaModelWeights,
  options: OmegaSearchOptions
): OmegaSearchVisit[] {
  const leaf = options.leaf ?? 'heuristic';
  const modelOptions: WarpSearchModelOptions = {
    useBeliefConstraints: options.useBeliefConstraints ?? true,
  };
  // Heuristic mode uses the base (Commander-heuristic) search model with real
  // rollouts; value mode swaps the leaf evaluator to the Omega value head.
  const model =
    leaf === 'value'
      ? createOmegaSearchModel(obs.objective, net, modelOptions)
      : createWarpSearchModel(obs.objective, modelOptions);
  const scored = ismctsSearchActionValues(
    observationToState(obs),
    model,
    {
      perspective: obs.playerId,
      rng: options.rng,
      maxIterations: options.iterations,
      timeBudgetMs: options.timeBudgetMs ?? 60_000,
      maxBranch: options.maxBranch ?? 8,
      explorationConstant: options.explorationConstant,
      rolloutDepth: leaf === 'value' ? 0 : (options.rolloutDepth ?? 24),
      rolloutPolicy: 'heuristic',
    },
    warpAiActionKey
  );
  return scored.map((entry) => ({
    action: entry.action,
    visits: entry.visits,
    value: entry.value,
  }));
}
