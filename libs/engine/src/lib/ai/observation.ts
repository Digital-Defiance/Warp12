import type { GameState, RoundState } from '../types/game-state.js';
import type { HouseRules } from '../types/house-rules.js';
import type { GameModules } from '../types/modules.js';
import type { GameObjective } from '../types/objective.js';
import type { Captain, PlayerId } from '../types/player.js';

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
  };
}
