/**
 * Random-play fuzz harness for whole-game engine verification.
 *
 * Drives full Warp 12 games by choosing uniformly at random among **every**
 * legal action for the active captain (charts, draw, beacon, pass, Red Alert
 * pass, Continuum Flash, Q-gamble, Drop to Impulse announce/catch, manual shields).
 * After every applied action it asserts a battery of invariants that must hold
 * for any correct rules engine — most importantly **tile conservation**: the 91
 * coordinates of a double-twelve set are never created, destroyed, or
 * duplicated across hands, the pile, the table, and the set-aside Spacedock.
 *
 * This is intentionally not an AI: random legal play explores strange states
 * (voluntary beacons, gambles, temporal inversion, blocked sectors) that a
 * heuristic officer would never choose, which is where engine bugs hide.
 */
import { applyAction } from './apply-action.js';
import { getLegalMoves } from './legal-moves.js';
import {
  checkRoundInvariants,
  collectAllRoundCoordinates,
  type InvariantViolation,
} from './engine-invariants.js';
import {
  canDeployDistressBeacon,
  canDrawFromUncharted,
  canPassRedAlert,
  canPassTurn,
  canRaiseShieldsManually,
} from './beacon.js';
import { isDropToImpulseAnnouncePending } from './drop-to-impulse.js';
import { scoreRound } from './scoring.js';
import { blockedRoundWinner } from '../ai/self-play.js';
import { startGame } from '../setup/create-game.js';
import {
  generateCoordinateSet,
  shuffleCoordinates,
} from '../domino/coordinates.js';
import { getAvailableFlashEffects } from '../types/continuum.js';
import { resolveHouseRules } from '../types/house-rules.js';
import type { HouseRules, HouseRulesConfig } from '../types/house-rules.js';
import type { GameModuleConfig } from '../types/modules.js';
import type { GameObjective } from '../types/objective.js';
import type { GameAction } from '../types/actions.js';
import type { GameState, RoundState } from '../types/game-state.js';

export { checkRoundInvariants, collectAllRoundCoordinates };
export type { InvariantViolation };

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Enumerate every legal action for the active captain in a playing round. */
export function enumerateLegalActions(
  state: GameState,
  round: RoundState,
  houseRules: HouseRules
): GameAction[] {
  const playerId = round.activePlayerId;
  const actions: GameAction[] = [];

  // Continuum Flash resolution takes priority — the invoker must pick an effect.
  if (round.continuumPendingInvoker === playerId) {
    for (const effect of getAvailableFlashEffects(
      round,
      state.modules,
      state.captains
    )) {
      actions.push({ type: 'INVOKE_CONTINUUM_FLASH', playerId, effect });
    }
    return actions;
  }

  if (round.continuumWagerPending?.playerId === playerId) {
    actions.push({ type: 'RESOLVE_CONTINUUM_WAGER', playerId, keepIndex: 0 });
    actions.push({ type: 'RESOLVE_CONTINUUM_WAGER', playerId, keepIndex: 1 });
    return actions;
  }

  for (const move of getLegalMoves(round, playerId, houseRules)) {
    actions.push({
      type: 'CHART_COORDINATE',
      playerId,
      coordinate: move.coordinate,
      route: move.route,
    });
  }

  if (canDrawFromUncharted(round, playerId, houseRules)) {
    actions.push({ type: 'DRAW_FROM_UNCHARTED', playerId });
  }
  if (canDeployDistressBeacon(round, playerId, { houseRules })) {
    actions.push({ type: 'DEPLOY_DISTRESS_BEACON', playerId });
  }
  if (canPassRedAlert(round, playerId, { houseRules })) {
    actions.push({ type: 'PASS_RED_ALERT', playerId });
  }
  if (canPassTurn(round, playerId, { houseRules })) {
    actions.push({ type: 'PASS_TURN', playerId });
  }
  if (canRaiseShieldsManually(round, playerId, houseRules)) {
    actions.push({ type: 'RAISE_SHIELDS', playerId });
  }
  if (isDropToImpulseAnnouncePending(round, playerId, houseRules)) {
    actions.push({ type: 'DROP_TO_IMPULSE', playerId });
  }
  if (round.allStopRequired && !round.allStopDeclared) {
    actions.push({ type: 'ALL_STOP', playerId });
  }

  return actions;
}

export interface RandomGameOptions {
  seed: number;
  captainCount: number;
  objective?: GameObjective;
  modules?: GameModuleConfig;
  houseRules?: HouseRulesConfig;
  maxSteps?: number;
}

export interface RandomGameResult {
  completed: boolean;
  completedRounds: number;
  steps: number;
  violations: InvariantViolation[];
  /** Set when the active captain had no legal action in a non-ended round. */
  deadlock: boolean;
  finalState: GameState;
}

function captainIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    String.fromCharCode('a'.charCodeAt(0) + i)
  );
}

/**
 * Play one full random-legal game, checking invariants after every action.
 * Detects deadlocks (active captain with no legal move in a live round) and
 * caps blocked sectors with the same stall guard the self-play runner uses.
 */
export function runRandomGame(options: RandomGameOptions): RandomGameResult {
  const rng = mulberry32(options.seed);
  const ids = captainIds(options.captainCount);
  const houseRules = resolveHouseRules(options.houseRules ?? {});

  const shuffled = shuffleCoordinates(generateCoordinateSet(12), rng);
  let state = startGame(
    {
      id: 'fuzz',
      captains: ids.map((id) => ({ id, displayName: id })),
      modules: options.modules,
      houseRules: options.houseRules,
      objective: options.objective,
    },
    { shuffledCoordinates: shuffled }
  );

  const reshuffle = mulberry32((options.seed ^ 0x9e3779b9) >>> 0);
  const violations: InvariantViolation[] = [];
  const maxSteps = options.maxSteps ?? 20000;
  let steps = 0;
  let deadlock = false;

  const totalHandTiles = (round: RoundState): number => {
    let total = 0;
    for (const id of round.turnOrder) total += (round.hands[id] ?? []).length;
    return total;
  };
  let stallGuard = 0;
  let lastHandTiles = state.round ? totalHandTiles(state.round) : -1;

  while (state.phase === 'active' && steps < maxSteps) {
    steps++;
    const round = state.round;
    if (!round) break;

    // Check invariants on every visited state.
    violations.push(...checkRoundInvariants(state, round));
    if (violations.length > 0) break;

    if (round.phase === 'ended') {
      const toScore =
        state.objective === 'go-out' &&
        round.roundBlocked &&
        !round.roundWinnerId
          ? { ...round, roundWinnerId: blockedRoundWinner(round, state) }
          : round;
      const result = scoreRound(state, toScore, reshuffle);
      if (!result.ok) {
        violations.push({ kind: 'score-round', detail: 'scoreRound failed' });
        break;
      }
      state = result.state;
      stallGuard = 0;
      lastHandTiles = state.round ? totalHandTiles(state.round) : -1;
      continue;
    }

    // Blocked-sector detection: pile empty and nobody progressing.
    if (round.unchartedSectors.length === 0) {
      const tiles = totalHandTiles(round);
      stallGuard = tiles === lastHandTiles ? stallGuard + 1 : 0;
      lastHandTiles = tiles;
      if (stallGuard >= ids.length * 2) {
        state = {
          ...state,
          round: {
            ...round,
            phase: 'ended',
            roundWinnerId: blockedRoundWinner(round, state),
            roundBlocked: true,
            allStopDeclared: true,
            allStopRequired: false,
          },
        };
        stallGuard = 0;
        continue;
      }
    } else {
      stallGuard = 0;
      lastHandTiles = totalHandTiles(round);
    }

    const actions = enumerateLegalActions(state, round, houseRules);
    if (actions.length === 0) {
      // Genuinely stuck live round with tiles still in play → engine bug,
      // unless it's the blocked-sector case handled by the stall guard above.
      if (round.unchartedSectors.length > 0) {
        deadlock = true;
        violations.push({
          kind: 'deadlock',
          detail: `captain ${round.activePlayerId} has no legal action with ${round.unchartedSectors.length} tiles in the pile`,
        });
        break;
      }
      // Pile empty: let the stall guard end the round on a future iteration.
      continue;
    }

    const action = actions[Math.floor(rng() * actions.length)];
    const result = applyAction(state, action);
    if (!result.ok) {
      violations.push({
        kind: 'illegal-action',
        detail: `enumerated action ${action.type} rejected: ${result.violation}`,
      });
      break;
    }
    state = result.state;
  }

  return {
    completed: state.phase === 'complete',
    completedRounds: state.completedRounds,
    steps,
    violations,
    deadlock,
    finalState: state,
  };
}
