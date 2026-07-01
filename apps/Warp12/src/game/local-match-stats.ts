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

/** Skill bucket plus Class I* flag for Firestore match history (`opponentClass1Star`). */
export function classifyLocalAiMatchOpponent(
  aiCaptains: readonly AiCaptainConfig[]
): { skill: WarpSkillLevel; opponentClass1Star: boolean } {
  const skill = classifyLocalAiMatchSkill(aiCaptains);
  const topTier = aiCaptains.filter((captain) => captain.skill === skill);
  return {
    skill,
    opponentClass1Star:
      topTier.length > 0 && topTier.every((captain) => captain.class1Star === true),
  };
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
    if (captain.pointsScore < winner.pointsScore) {
      winner = captain;
    }
  }
  return winner.id === humanId;
}
