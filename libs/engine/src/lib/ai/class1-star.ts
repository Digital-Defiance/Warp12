import type { GameObjective } from '../types/objective.js';
import {
  getWarpSkillProfile,
  resolveWarpLookahead,
  type WarpSkillProfile,
  type WarpTableRole,
} from './skill.js';
import {
  createWarpAiPlayer,
  type CreateWarpAiPlayerOptions,
  type WarpAiPlayer,
} from './create-warp-ai.js';
import type { Class1StarResidualScorer } from './residual-scorer.js';

export interface CreateClass1StarPlayerOptions
  extends Omit<CreateWarpAiPlayerOptions, 'skill' | 'residualScorer'> {
  /** Defaults to commander-equivalent profile for table size / objective. */
  skill?: WarpSkillProfile;
  /** Required learned residual; use {@link createTsResidualScorer} for CPU fallback. */
  residualScorer: Class1StarResidualScorer;
  playerCount?: number;
  tableRole?: WarpTableRole;
}

/**
 * Commander skill profile for Class I* play AI.
 * TEI storage bucket remains `commander`; UI may label this tier Class I*.
 */
export function getClass1StarSkillProfile(
  objective: GameObjective = 'points',
  playerCount?: number,
  tableRole?: WarpTableRole
): WarpSkillProfile {
  return getWarpSkillProfile('commander', objective, playerCount, tableRole);
}

/** Heuristic Commander + on-device residual scorer (play path only). */
export function createClass1StarPlayer(
  options: CreateClass1StarPlayerOptions
): WarpAiPlayer {
  const objective = options.objective ?? 'points';
  const playerCount = options.playerCount;
  const skill =
    options.skill ??
    getClass1StarSkillProfile(objective, playerCount, options.tableRole);
  const lookahead =
    options.lookahead ??
    resolveWarpLookahead('commander', objective, playerCount);

  const playerOptions: CreateWarpAiPlayerOptions = {
    ...options,
    skill,
    objective,
    lookahead,
    residualScorer: options.residualScorer,
  };

  return createWarpAiPlayer(playerOptions);
}
