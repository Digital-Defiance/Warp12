import type { PlayerRef, Rng, SearchModel } from 'double-eighteen';
import {
  coordinateKey,
  coordinatePipValue,
  type Coordinate,
} from '../types/coordinate.js';
import {
  generateCoordinateSet,
} from '../domino/coordinates.js';
import { applyAction } from '../engine/apply-action.js';
import type { GameState } from '../types/game-state.js';
import type { GameModules } from '../types/modules.js';
import { DEFAULT_HOUSE_RULES } from '../types/house-rules.js';
import { salamanderPenaltyApplies, salamanderPenaltyTileValue } from '../constants/setup.js';
import type { GameObjective } from '../types/objective.js';
import type { PlayerId } from '../types/player.js';
import { toGameAction, type WarpAiAction } from './actions.js';
import { warpCandidateGenerator } from './candidate-generator.js';
import { assignHiddenHands } from './belief-constraints.js';
import { collectPlacedCoordinates } from './context.js';
import type { WarpAiObservation } from './observation.js';

/** Points weight of a hand, honoring Salamander on the highest double. */
export function handPips(
  hand: readonly Coordinate[],
  modules: GameModules,
  roundNumber: number,
  maxPip = 12
): number {
  const salamander =
    modules.salamanderPenalty.enabled && salamanderPenaltyApplies(roundNumber);
  let total = 0;
  for (const coordinate of hand) {
    if (
      salamander &&
      coordinate.low === maxPip &&
      coordinate.high === maxPip
    ) {
      total += salamanderPenaltyTileValue(maxPip);
    } else {
      total += coordinatePipValue(coordinate);
    }
  }
  return total;
}

/** Tile count in hand — the go-out objective cares about this, not pip weight. */
export function handTileCount(hand: readonly Coordinate[]): number {
  return hand.length;
}

/**
 * Leaf evaluation for the penalty-scoring campaign: minimize held pips, maximize
 * what opponents are stuck with, treat going out as decisive.
 */
export function warpLeafEvalPenalty(
  state: GameState,
  perspective: PlayerRef
): number {
  const round = state.round;
  if (!round) return 0;
  const modules = state.modules;

  const maxPip = state.maxPip ?? 12;
  const mine = handPips(
    round.hands[perspective as PlayerId] ?? [],
    modules,
    round.roundNumber,
    maxPip
  );
  let opponentTotal = 0;
  let opponents = 0;
  for (const id of round.turnOrder) {
    if (id === perspective) continue;
    opponentTotal += handPips(
      round.hands[id] ?? [],
      modules,
      round.roundNumber,
      maxPip
    );
    opponents++;
  }
  const opponentAvg = opponents > 0 ? opponentTotal / opponents : 0;

  if (round.phase === 'ended') {
    return round.roundWinnerId === perspective
      ? 10000 + opponentAvg
      : -1000 - mine + opponentAvg;
  }
  return opponentAvg - mine;
}

/**
 * Leaf evaluation for first-out-wins: minimize tiles held, maximize opponent
 * hand sizes; pip weight and Salamander are irrelevant.
 */
export function warpLeafEvalGoOut(
  state: GameState,
  perspective: PlayerRef
): number {
  const round = state.round;
  if (!round) return 0;

  const mine = handTileCount(round.hands[perspective as PlayerId] ?? []);
  let opponentTotal = 0;
  let opponents = 0;
  let minOpp = Number.POSITIVE_INFINITY;
  for (const id of round.turnOrder) {
    if (id === perspective) continue;
    const count = handTileCount(round.hands[id] ?? []);
    opponentTotal += count;
    opponents++;
    minOpp = Math.min(minOpp, count);
  }
  const opponentAvg = opponents > 0 ? opponentTotal / opponents : 0;

  if (round.phase !== 'ended' && minOpp <= 1 && mine > 1) {
    return -50_000 + opponentAvg - mine;
  }

  if (round.phase === 'ended') {
    return round.roundWinnerId === perspective
      ? 10000 + opponentAvg
      : -1000 - mine + opponentAvg;
  }
  return opponentAvg - mine;
}

/** @deprecated Use {@link warpLeafEvalPenalty} or {@link warpLeafEvalGoOut}. */
export function warpLeafEval(state: GameState, perspective: PlayerRef): number {
  return state.objective === 'go-out'
    ? warpLeafEvalGoOut(state, perspective)
    : warpLeafEvalPenalty(state, perspective);
}

/** Build a Game State wrapper around an observation for the forward model. */
export function observationToState(obs: WarpAiObservation): GameState {
  return {
    id: 'search',
    phase: 'active',
    captains: obs.captains.length > 0
      ? obs.captains
      : obs.round.turnOrder.map((id) => ({
          id,
          displayName: id,
          pointsScore: 0,
        })),
    round: obs.round,
    completedRounds: 0,
    modules: obs.modules,
    houseRules: obs.houseRules,
    objective: obs.objective,
    campaignRounds: obs.campaignRounds,
    maxPip: obs.maxPip ?? 12,
  };
}

function rankAction(
  action: WarpAiAction,
  objective: GameObjective,
  handSize: number
): number {
  switch (action.kind) {
    case 'all-stop':
      return 10_000;
    case 'catch-drop-to-impulse':
      return 9_000;
    case 'chart':
      if (objective === 'go-out' && handSize === 1) return 20_000;
      return objective === 'go-out'
        ? 100 + (10 - handSize)
        : 100 + coordinatePipValue(action.move.coordinate);
    case 'drop-to-impulse':
      return 500;
    case 'draw':
      return -1;
    case 'raise-shields':
      return -100;
    case 'invoke-continuum-flash':
    case 'resolve-continuum-wager':
      return 5_000;
    default:
      return -2;
  }
}

export interface WarpSearchModelOptions {
  /** Rejection-sample opponent hands for observable consistency. */
  useBeliefConstraints?: boolean;
}

/**
 * A {@link SearchModel} over Warp12's own engine, in {@link WarpAiAction} space.
 * Hidden information (opponent hands + the draw order) is resampled by
 * `determinize`, so the search plays honestly rather than peeking at the
 * authoritative round state.
 */
export function createWarpSearchModel(
  objective: GameObjective = 'points',
  modelOptions: WarpSearchModelOptions = {}
): SearchModel<GameState, WarpAiAction> {
  const useBeliefConstraints = modelOptions.useBeliefConstraints ?? false;
  const evaluate =
    objective === 'go-out' ? warpLeafEvalGoOut : warpLeafEvalPenalty;

  return {
    legalActions(state: GameState) {
      const round = state.round;
      if (!round || round.phase !== 'playing') return [];
      return warpCandidateGenerator({
        round,
        playerId: round.activePlayerId,
        modules: state.modules,
        houseRules: state.houseRules ?? DEFAULT_HOUSE_RULES,
        objective: state.objective,
        campaignRounds: state.campaignRounds,
        captains: state.captains,
      });
    },

    applyAction(state: GameState, action: WarpAiAction) {
      const round = state.round;
      if (!round) return state;
      const result = applyAction(
        state,
        toGameAction(action, round.activePlayerId)
      );
      return result.ok ? result.state : state;
    },

    isTerminal(state: GameState) {
      return (
        state.phase === 'complete' ||
        !state.round ||
        state.round.phase === 'ended'
      );
    },

    currentPlayer(state: GameState): PlayerRef {
      return state.round?.activePlayerId ?? '';
    },

    evaluate,

    orderActions(state: GameState, actions: WarpAiAction[]) {
      const handSize =
        state.round?.hands[state.round.activePlayerId]?.length ?? 0;
      return [...actions].sort(
        (a, b) =>
          rankAction(b, objective, handSize) - rankAction(a, objective, handSize)
      );
    },

    determinize(state: GameState, perspective: PlayerRef, rng: Rng) {
      const round = state.round;
      if (!round) return state;

      const seen = new Set<string>();
      for (const coordinate of collectPlacedCoordinates(round.table)) {
        seen.add(coordinateKey(coordinate));
      }
      const myHand = round.hands[perspective as PlayerId] ?? [];
      for (const coordinate of myHand) {
        seen.add(coordinateKey(coordinate));
      }

      const pool = generateCoordinateSet(12).filter(
        (coordinate) => !seen.has(coordinateKey(coordinate))
      );

      const assigned = assignHiddenHands(
        state,
        perspective as PlayerId,
        pool,
        rng,
        useBeliefConstraints
      );

      if (!assigned) {
        return state;
      }

      const assignedKeys = new Set<string>();
      for (const id of round.turnOrder) {
        for (const coordinate of assigned[id] ?? []) {
          assignedKeys.add(coordinateKey(coordinate));
        }
      }
      const remainder = pool.filter(
        (coordinate) => !assignedKeys.has(coordinateKey(coordinate))
      );

      return {
        ...state,
        round: {
          ...round,
          hands: assigned,
          unchartedSectors: remainder,
        },
      };
    },
  };
}
