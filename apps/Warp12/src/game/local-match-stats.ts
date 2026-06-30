import type { GameState, WarpSkillLevel } from 'warp12-engine';

import type { AiCaptainConfig } from './local-game-config.js';

const SKILL_TIER_ORDER: Record<WarpSkillLevel, number> = {
  ensign: 0,
  lieutenant: 1,
  commander: 2,
};

/** Highest AI skill at the table determines the local stats bucket. */
export function classifyLocalAiMatchSkill(
  aiCaptains: readonly AiCaptainConfig[]
): WarpSkillLevel {
  return aiCaptains.reduce<WarpSkillLevel>(
    (max, captain) =>
      SKILL_TIER_ORDER[captain.skill] > SKILL_TIER_ORDER[max] ? captain.skill : max,
    'ensign'
  );
}

export function humanWonLocalMatch(game: GameState, humanId: string): boolean {
  if (game.phase !== 'complete') {
    return false;
  }

  if (game.objective === 'go-out') {
    return game.round?.roundWinnerId === humanId;
  }

  let winner = game.captains[0];
  for (const captain of game.captains) {
    if (captain.penaltyScore < winner.penaltyScore) {
      winner = captain;
    }
  }
  return winner.id === humanId;
}
