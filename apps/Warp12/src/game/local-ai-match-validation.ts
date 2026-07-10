import type { GameAction } from 'warp12-engine';

import type { LocalGameConfig } from './local-game-config.js';
import { isPassAndPlay, localMatchHasExtendedThinking } from './local-game-config.js';
import type { RatedObjective } from '../firebase/stats-schema.js';
import type { WarpSkillLevel } from 'warp12-engine';

export interface LocalAiMatchValidationInput {
  skill: WarpSkillLevel;
  objective: RatedObjective;
  advisorUsed?: boolean;
  opponentOmega?: boolean;
  seed?: number;
  config?: LocalGameConfig;
  humanActions?: readonly GameAction[];
}

function humanActionsForReplay(
  actions: readonly GameAction[]
): GameAction[] {
  return actions.filter((action) => action.type !== 'END_ROUND');
}

export type LocalAiMatchRejectReason =
  | 'invalid_skill'
  | 'invalid_objective'
  | 'missing_advisor_used'
  | 'pass_and_play'
  | 'extended_thinking'
  | 'exhibition_set'
  | 'missing_seed'
  | 'missing_config'
  | 'missing_human_actions'
  | 'no_replayable_human_actions';

/** Why a local vs-AI row cannot be verified server-side (null = uploadable). */
export function getLocalAiMatchRejectReason(
  input: LocalAiMatchValidationInput
): LocalAiMatchRejectReason | null {
  if (
    input.skill !== 'ensign' &&
    input.skill !== 'lieutenant' &&
    input.skill !== 'commander'
  ) {
    return 'invalid_skill';
  }
  if (input.objective !== 'go-out' && input.objective !== 'points') {
    return 'invalid_objective';
  }
  if (typeof input.advisorUsed !== 'boolean') {
    return 'missing_advisor_used';
  }
  if (typeof input.seed !== 'number' || !Number.isFinite(input.seed)) {
    return 'missing_seed';
  }
  if (!input.config || typeof input.config !== 'object') {
    return 'missing_config';
  }
  const config = input.config as LocalGameConfig;
  if (isPassAndPlay(config)) {
    return 'pass_and_play';
  }
  if (localMatchHasExtendedThinking(config.aiCaptains)) {
    return 'extended_thinking';
  }
  if ((config.maxPip ?? 12) !== 12) {
    return 'exhibition_set';
  }
  if (!Array.isArray(input.humanActions)) {
    return 'missing_human_actions';
  }
  if (humanActionsForReplay(input.humanActions).length === 0) {
    return 'no_replayable_human_actions';
  }
  return null;
}

export function isReplayableLocalAiMatch(
  input: LocalAiMatchValidationInput
): boolean {
  return getLocalAiMatchRejectReason(input) === null;
}

export function localAiMatchRejectNotice(
  reason: LocalAiMatchRejectReason
): string {
  switch (reason) {
    case 'pass_and_play':
      return 'Pass-and-play matches are unrated — TEI is not tracked.';
    case 'extended_thinking':
      return 'Extended-thinking Class II officers are exhibition mode — TEI is not tracked.';
    case 'exhibition_set':
      return 'Warp 9 / 15 / 18 are exhibition sets — TEI is only tracked on Warp 12.';
    case 'missing_advisor_used':
    case 'missing_seed':
    case 'missing_config':
    case 'missing_human_actions':
    case 'no_replayable_human_actions':
    case 'invalid_skill':
    case 'invalid_objective':
      return 'This match cannot be synced — start a new unassisted vs-AI game to update TEI.';
  }
}

export function filterHumanActionsForReplay(
  actions: readonly GameAction[]
): GameAction[] {
  return humanActionsForReplay(actions);
}
