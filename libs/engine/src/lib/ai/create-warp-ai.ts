import {
  chooseActionIndex,
  createPolicyPlayer,
  type GenericHeuristic,
  type Rng,
} from 'doubletwelve';
import type { GameAction } from '../types/actions.js';
import type { GameState } from '../types/game-state.js';
import type { GameObjective } from '../types/objective.js';
import type { PlayerId } from '../types/player.js';
import { type WarpAiAction } from './actions.js';
import { toGameAction } from './actions.js';
import {
  augmentSearchValuesWithResidual,
  augmentSearchValuesWithResidualAsync,
  pickWarpActionWithResidual,
  pickWarpActionWithResidualAsync,
} from './class1-star-policy.js';
import { warpCandidateGenerator, warpOffTurnCandidateGenerator } from './candidate-generator.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import { buildWarpContext, type WarpEvalContext } from './context.js';
import { DEFAULT_WARP_HEURISTICS } from './heuristics.js';
import type { LookaheadOptions } from './lookahead-options.js';
import type { Class1StarResidualScorer } from './residual-scorer.js';
import {
  resolveProfileGoOutTuning,
  type WarpSkillProfile,
} from './skill.js';
import { observe, type WarpAiObservation } from './observation.js';
import {
  createWarpSearchModel,
  observationToState,
} from './search-model.js';
import { warpAiActionKey } from './from-game-action.js';
import { ismctsSearchActionValues } from './ismcts.js';
import { searchActionValuesWithBudget } from './time-budget-search.js';

export type { LookaheadOptions } from './lookahead-options.js';

export interface CreateWarpAiPlayerOptions {
  skill: WarpSkillProfile;
  /** Defaults to {@link DEFAULT_WARP_HEURISTICS}. Append your own for house tactics. */
  heuristics?: ReadonlyArray<GenericHeuristic<WarpAiAction, WarpEvalContext>>;
  /** Defaults to {@link warpCandidateGenerator}. Replace for house access rules. */
  generateCandidates?: (obs: WarpAiObservation) => WarpAiAction[];
  /** Opt into forward-simulating lookahead. Omit for the fast greedy policy. */
  lookahead?: LookaheadOptions;
  /** Victory condition the bot optimizes for (defaults to `points`). */
  objective?: GameObjective;
  /** Defaults to `Math.random`. Inject a seeded RNG for reproducible games/tests. */
  rng?: Rng;
  /**
   * Class I* play-path residual only — never used by advisor / coach scoring.
   * Heuristic scores stay explainable; residual nudges final pick.
   */
  residualScorer?: Class1StarResidualScorer;
}

export interface WarpAiPlayer {
  /** Choose an AI action for an explicit observation. */
  decide(obs: WarpAiObservation): WarpAiAction;
  /** Async decision path for Class I* ORT inference. */
  decideAsync(obs: WarpAiObservation): Promise<WarpAiAction>;
  /** Choose and lower to an engine action for `applyAction`; null if no round. */
  decideGameAction(state: GameState, playerId: PlayerId): GameAction | null;
  decideGameActionAsync(
    state: GameState,
    playerId: PlayerId
  ): Promise<GameAction | null>;
  /**
   * Off-turn reactions (e.g. catch a missed Drop to Impulse). Null when nothing
   * to do for this captain.
   */
  decideOffTurnGameAction(state: GameState, playerId: PlayerId): GameAction | null;
  decideOffTurnGameActionAsync(
    state: GameState,
    playerId: PlayerId
  ): Promise<GameAction | null>;
}

/**
 * An offline, heuristic Warp 12 captain. It runs entirely on Warp12-lib's own
 * engine (so all of RULES.md — Distress Beacons, Red Alerts, Subspace Fractures,
 * the Neutral Zone, treaties, modules — is honored) while reusing DoubleTwelve's
 * model-agnostic decision policy for skill, scoring, and selection.
 */
export function createWarpAiPlayer(
  options: CreateWarpAiPlayerOptions
): WarpAiPlayer {
  const rng = options.rng ?? Math.random;
  const objective = options.objective ?? 'points';
  const skill = options.skill;
  const goOutTuning = resolveProfileGoOutTuning(skill);
  const heuristics = options.heuristics ?? DEFAULT_WARP_HEURISTICS;
  const generateCandidates = options.generateCandidates ?? warpCandidateGenerator;
  const residualScorer = options.residualScorer;
  const residualIsAsync = residualScorer?.inference === 'async';

  const fallback = (obs: WarpAiObservation): WarpAiAction => {
    if (canDrawFromUncharted(obs.round, obs.playerId, obs.houseRules)) {
      return { kind: 'draw' };
    }
    if (canPassRedAlert(obs.round, obs.playerId, { houseRules: obs.houseRules })) {
      return { kind: 'pass-red-alert' };
    }
    if (canDeployDistressBeacon(obs.round, obs.playerId, { houseRules: obs.houseRules })) {
      return { kind: 'deploy-beacon' };
    }
    if (canPassTurn(obs.round, obs.playerId, { houseRules: obs.houseRules })) {
      return { kind: 'pass-turn' };
    }
    return { kind: 'deploy-beacon' };
  };

  const greedy = createPolicyPlayer<WarpAiObservation, WarpAiAction, WarpEvalContext>({
    skill,
    heuristics,
    generateCandidates,
    buildContext: (obs: WarpAiObservation) =>
      buildWarpContext(obs, rng, goOutTuning),
    fallback,
    rng,
  });

  const decideGreedy = (obs: WarpAiObservation): WarpAiAction => {
    const candidates = generateCandidates(obs);
    if (candidates.length === 0) {
      return fallback(obs);
    }
    if (residualScorer) {
      if (residualIsAsync) {
        throw new Error(
          'Class I* async residual scorer requires decideAsync or decideGameActionAsync.'
        );
      }
      return pickWarpActionWithResidual(
        obs,
        candidates,
        skill,
        residualScorer,
        rng,
        goOutTuning,
        heuristics
      );
    }
    return greedy.decide(obs);
  };

  const decideGreedyAsync = async (
    obs: WarpAiObservation
  ): Promise<WarpAiAction> => {
    const candidates = generateCandidates(obs);
    if (candidates.length === 0) {
      return fallback(obs);
    }
    if (residualScorer) {
      if (residualIsAsync) {
        return pickWarpActionWithResidualAsync(
          obs,
          candidates,
          skill,
          residualScorer,
          rng,
          goOutTuning,
          heuristics
        );
      }
      return pickWarpActionWithResidual(
        obs,
        candidates,
        skill,
        residualScorer,
        rng,
        goOutTuning,
        heuristics
      );
    }
    return greedy.decide(obs);
  };

  const lookahead: LookaheadOptions | undefined =
    options.lookahead ??
    (skill.lookaheadDepth > 0
      ? { depth: skill.lookaheadDepth, determinizations: 4, maxBranch: 5 }
      : undefined);
  const searchModel = lookahead
    ? createWarpSearchModel(objective, {
        useBeliefConstraints: lookahead.useBeliefConstraints ?? false,
      })
    : null;

  const runSearch = (obs: WarpAiObservation) => {
    if (!lookahead || !searchModel) {
      return null;
    }
    const rootState = observationToState(obs);
    if (lookahead.searchEngine === 'ismcts') {
      return ismctsSearchActionValues(
        rootState,
        searchModel,
        {
          perspective: obs.playerId,
          rng,
          timeBudgetMs: lookahead.timeBudgetMs ?? 500,
          maxIterations: lookahead.ismctsMaxIterations,
          explorationConstant: lookahead.ismctsExplorationConstant,
          maxBranch: lookahead.maxBranch ?? 8,
          rolloutDepth: lookahead.ismctsRolloutDepth,
        },
        warpAiActionKey
      );
    }
    return searchActionValuesWithBudget(rootState, searchModel, {
      perspective: obs.playerId,
      rng,
      lookahead,
    });
  };

  const augmentSearchWithResidual = lookahead?.searchEngine !== 'ismcts';

  const decide = (obs: WarpAiObservation): WarpAiAction => {
    if (residualScorer && residualIsAsync) {
      throw new Error(
        'Class I* async residual scorer requires decideAsync or decideGameActionAsync.'
      );
    }
    if (!lookahead || !searchModel) {
      return decideGreedy(obs);
    }

    const scored = runSearch(obs)!;

    if (scored.length === 0) return decideGreedy(obs);
    if (scored.length === 1) return scored[0].action;
    if (skill.blunderRate > 0 && rng() < skill.blunderRate) {
      return scored[Math.floor(rng() * scored.length)].action;
    }
    const values =
      residualScorer && augmentSearchWithResidual
        ? augmentSearchValuesWithResidual(
            obs,
            scored,
            residualScorer,
            rng,
            goOutTuning
          )
        : scored.map(
            (entry: { action: WarpAiAction; value: number }) => entry.value
          );
    const index = chooseActionIndex(values, skill, rng);
    return scored[index].action;
  };

  const decideAsync = async (obs: WarpAiObservation): Promise<WarpAiAction> => {
    if (!lookahead || !searchModel) {
      return decideGreedyAsync(obs);
    }

    await Promise.resolve();
    const scored = runSearch(obs)!;

    if (scored.length === 0) return decideGreedyAsync(obs);
    if (scored.length === 1) return scored[0].action;
    if (skill.blunderRate > 0 && rng() < skill.blunderRate) {
      return scored[Math.floor(rng() * scored.length)].action;
    }
    const values =
      residualScorer && augmentSearchWithResidual
        ? await augmentSearchValuesWithResidualAsync(
            obs,
            scored,
            residualScorer,
            rng,
            goOutTuning
          )
        : scored.map(
            (entry: { action: WarpAiAction; value: number }) => entry.value
          );
    const index = chooseActionIndex(values, skill, rng);
    return scored[index].action;
  };

  return {
    decide,
    decideAsync,
    decideGameAction(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      return toGameAction(decide(obs), playerId);
    },
    async decideGameActionAsync(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      const action = await decideAsync(obs);
      return toGameAction(action, playerId);
    },
    decideOffTurnGameAction(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      const offTurn = warpOffTurnCandidateGenerator(obs);
      if (offTurn.length === 0) return null;
      const action =
        offTurn.length === 1 ? offTurn[0] : decideGreedy(obs);
      return toGameAction(action, playerId);
    },
    async decideOffTurnGameActionAsync(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      const offTurn = warpOffTurnCandidateGenerator(obs);
      if (offTurn.length === 0) return null;
      const action =
        offTurn.length === 1 ? offTurn[0] : await decideGreedyAsync(obs);
      return toGameAction(action, playerId);
    },
  };
}
