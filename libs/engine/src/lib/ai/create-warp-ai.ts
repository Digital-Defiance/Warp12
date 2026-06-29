import {
  chooseActionIndex,
  createPolicyPlayer,
  searchActionValues,
  type GenericHeuristic,
  type Rng,
  type SkillProfile,
} from 'doubletwelve';
import type { GameAction } from '../types/actions.js';
import type { GameState } from '../types/game-state.js';
import type { GameObjective } from '../types/objective.js';
import type { PlayerId } from '../types/player.js';
import { type WarpAiAction } from './actions.js';
import { toGameAction } from './actions.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import {
  canDeployDistressBeacon,
  canPassRedAlert,
  canPassTurn,
} from '../engine/beacon.js';
import { buildWarpContext, type WarpEvalContext } from './context.js';
import { DEFAULT_WARP_HEURISTICS } from './heuristics.js';
import { observe, type WarpAiObservation } from './observation.js';
import {
  createWarpSearchModel,
  observationToState,
} from './search-model.js';

/**
 * Turns on "gaming it out": instead of scoring the current options with
 * heuristics, the bot simulates each move forward with the engine, samples the
 * hidden hands/draw a few times, and looks `depth` plies ahead. More expensive,
 * but it reasons about consequences (e.g. setting up an opponent to go out).
 */
export interface LookaheadOptions {
  /** Plies to search, including the bot's own move (>= 1). */
  depth: number;
  /** Hidden-world samples per move for imperfect-information averaging (default 6). */
  determinizations?: number;
  /** Cap candidate moves expanded per node, best-first (default 6). */
  maxBranch?: number;
}

export interface CreateWarpAiPlayerOptions {
  skill: SkillProfile;
  /** Defaults to {@link DEFAULT_WARP_HEURISTICS}. Append your own for house tactics. */
  heuristics?: ReadonlyArray<GenericHeuristic<WarpAiAction, WarpEvalContext>>;
  /** Defaults to {@link warpCandidateGenerator}. Replace for house access rules. */
  generateCandidates?: (obs: WarpAiObservation) => WarpAiAction[];
  /** Opt into forward-simulating lookahead. Omit for the fast greedy policy. */
  lookahead?: LookaheadOptions;
  /** Victory condition the bot optimizes for (defaults to `penalty`). */
  objective?: GameObjective;
  /** Defaults to `Math.random`. Inject a seeded RNG for reproducible games/tests. */
  rng?: Rng;
}

export interface WarpAiPlayer {
  /** Choose an AI action for an explicit observation. */
  decide(obs: WarpAiObservation): WarpAiAction;
  /** Choose and lower to an engine action for `applyAction`; null if no round. */
  decideGameAction(state: GameState, playerId: PlayerId): GameAction | null;
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
  const objective = options.objective ?? 'penalty';
  const skill = options.skill;
  const heuristics = options.heuristics ?? DEFAULT_WARP_HEURISTICS;
  const generateCandidates = options.generateCandidates ?? warpCandidateGenerator;

  const greedy = createPolicyPlayer<WarpAiObservation, WarpAiAction, WarpEvalContext>({
    skill,
    heuristics,
    generateCandidates,
    buildContext: (obs: WarpAiObservation) => buildWarpContext(obs, rng),
    fallback: (obs: WarpAiObservation) => {
      if (obs.round.unchartedSectors.length > 0) {
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
    },
    rng,
  });

  const lookahead = options.lookahead;
  const searchModel = lookahead ? createWarpSearchModel(objective) : null;

  const decide = (obs: WarpAiObservation): WarpAiAction => {
    if (!lookahead || !searchModel) {
      return greedy.decide(obs);
    }

    const scored = searchActionValues(observationToState(obs), searchModel, {
      depth: lookahead.depth,
      perspective: obs.playerId,
      rng,
      determinizations: lookahead.determinizations ?? 6,
      maxBranch: lookahead.maxBranch ?? 6,
    });

    if (scored.length === 0) return greedy.decide(obs);
    if (scored.length === 1) return scored[0].action;
    // Skill still applies on top of search: blunder, then temperature-shaped
    // choice over the searched values (advanced ≈ argmax, beginner ≈ noisy).
    if (skill.blunderRate > 0 && rng() < skill.blunderRate) {
      return scored[Math.floor(rng() * scored.length)].action;
    }
    const index = chooseActionIndex(
      scored.map((entry: { action: WarpAiAction; value: number }) => entry.value),
      skill,
      rng
    );
    return scored[index].action;
  };

  return {
    decide,
    decideGameAction(state, playerId) {
      const obs = observe(state, playerId);
      if (!obs) return null;
      return toGameAction(decide(obs), playerId);
    },
  };
}
