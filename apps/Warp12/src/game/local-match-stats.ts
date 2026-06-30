import type { GameState, WarpSkillLevel } from 'warp12-engine';

import type { AiCaptainConfig } from './local-game-config.js';

const SKILL_RANK: Record<WarpSkillLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
};

/** Highest AI skill at the table determines the local stats bucket. */
export function classifyLocalAiMatchSkill(
  aiCaptains: readonly AiCaptainConfig[]
): WarpSkillLevel {
  return aiCaptains.reduce<WarpSkillLevel>(
    (max, captain) =>
      SKILL_RANK[captain.skill] > SKILL_RANK[max] ? captain.skill : max,
    'beginner'
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
