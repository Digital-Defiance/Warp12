import type { GameState, RoundState } from '../types/game-state.js';
import type { HouseRules } from '../types/house-rules.js';
import type { GameModules } from '../types/modules.js';
import type { GameObjective } from '../types/objective.js';
import type { Captain, PlayerId } from '../types/player.js';
import { DOUBLE_TWELVE_MAX_PIPS } from '../constants/setup.js';

/**
 * What a Warp 12 bot is allowed to see this turn: the public round state, which
 * captain it is, and the active opt-in modules (so module-aware heuristics like
 * Salamander and Continuum can adjust). Opponent hands are intentionally
 * excluded — only their hand counts/placed tiles are knowable.
 */
export interface WarpAiObservation {
  readonly round: RoundState;
  readonly playerId: PlayerId;
  readonly modules: GameModules;
  readonly houseRules: HouseRules;
  readonly objective: GameObjective;
  readonly campaignRounds: number;
  readonly captains: readonly Captain[];
  /** Double-N max pip for this sector (defaults to 12). */
  readonly maxPip?: number;
  /** Module Theta (Go-out): who already claimed Trail Momentum this sector. */
  readonly trailMomentumClaimedBy?: PlayerId | null;
  /** Module Kappa (Go-out): Hand Exchange already resolved/skipped this sector. */
  readonly handExchangeResolved?: boolean;
}

/** Build a Game State wrapper around an observation for the forward model / legal APIs. */
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
    ...(obs.trailMomentumClaimedBy != null
      ? { trailMomentumClaimedBy: obs.trailMomentumClaimedBy }
      : {}),
    ...(obs.handExchangeResolved ? { handExchangeResolved: true } : {}),
  };
}

/** Builds an observation for `playerId` from a game state, or null if no round. */
export function observe(
  state: GameState,
  playerId: PlayerId
): WarpAiObservation | null {
  if (!state.round) {
    return null;
  }
  return {
    round: state.round,
    playerId,
    modules: state.modules,
    houseRules: state.houseRules,
    objective: state.objective,
    campaignRounds: state.campaignRounds,
    captains: state.captains,
    maxPip: state.maxPip ?? DOUBLE_TWELVE_MAX_PIPS,
    trailMomentumClaimedBy: state.trailMomentumClaimedBy ?? null,
    handExchangeResolved: state.handExchangeResolved === true,
  };
}
