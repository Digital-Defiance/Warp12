import type { RatedObjective } from './rated-match-schema.js';
import {
  WARP12_OFFICIAL_RULES_PROFILE_ID,
  WARP12_OFFICIAL_V1_RULES_PROFILE_ID,
} from './rules-profile.js';

export type { RatedObjective } from './rated-match-schema.js';
export type AiSkillLevel = 'ensign' | 'lieutenant' | 'commander';

export const DEFAULT_UNASSISTED_TEI = 1000;

/** Heuristic Class II anchors (`warp12-official-v1`). */
export const AI_OPPONENT_TEI_POINTS_V1: Record<AiSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1200,
  commander: 1400,
};

export const AI_OPPONENT_TEI_GO_OUT_V1: Record<AiSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1250,
  commander: 1500,
};

/**
 * Neural Class II (Ω) anchors (`warp12-official-v2`).
 * Calibrated 2026-07 from full 2–8p bench vs legacy Commander, tempered for
 * typical 2–4p solo play (points mean ~1.38× fleet-wide; go-out ~1.14×).
 */
export const AI_OPPONENT_TEI_POINTS_V2: Record<AiSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1200,
  commander: 1520,
};

export const AI_OPPONENT_TEI_GO_OUT_V2: Record<AiSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1250,
  commander: 1550,
};

/** Current default reference bands (v2). */
export const AI_OPPONENT_TEI_POINTS = AI_OPPONENT_TEI_POINTS_V2;
export const AI_OPPONENT_TEI_GO_OUT = AI_OPPONENT_TEI_GO_OUT_V2;

export function opponentTeiTablesForRulesProfile(rulesProfileId: string): {
  readonly points: Record<AiSkillLevel, number>;
  readonly goOut: Record<AiSkillLevel, number>;
} {
  if (rulesProfileId === WARP12_OFFICIAL_V1_RULES_PROFILE_ID) {
    return {
      points: AI_OPPONENT_TEI_POINTS_V1,
      goOut: AI_OPPONENT_TEI_GO_OUT_V1,
    };
  }
  return {
    points: AI_OPPONENT_TEI_POINTS_V2,
    goOut: AI_OPPONENT_TEI_GO_OUT_V2,
  };
}

export function opponentTeiForObjective(
  objective: RatedObjective,
  skill: AiSkillLevel,
  rulesProfileId: string = WARP12_OFFICIAL_RULES_PROFILE_ID
): number {
  const tables = opponentTeiTablesForRulesProfile(rulesProfileId);
  return objective === 'go-out' ? tables.goOut[skill] : tables.points[skill];
}

export function kFactor(unassistedMatchesPlayed: number): number {
  if (unassistedMatchesPlayed < 10) {
    return 40;
  }
  if (unassistedMatchesPlayed < 30) {
    return 32;
  }
  return 24;
}

export function expectedEloScore(
  playerTei: number,
  opponentTei: number
): number {
  return 1 / (1 + 10 ** ((opponentTei - playerTei) / 400));
}

export function updateTeiScore(
  playerTei: number,
  opponentTei: number,
  score: number,
  k: number
): number {
  const expected = expectedEloScore(playerTei, opponentTei);
  return Math.round(playerTei + k * (score - expected));
}

export function updateUnassistedTei(
  playerTei: number,
  opponentTei: number,
  score: 0 | 1,
  k: number
): number {
  return updateTeiScore(playerTei, opponentTei, score, k);
}

export interface TeiRankedPlayer {
  readonly playerId: string;
  readonly rank: number;
  readonly tei: number;
  readonly unassistedMatches?: number;
}

export function rankCompetition(
  entries: readonly { playerId: string; score: number }[],
  lowerIsBetter = true
): Map<string, number> {
  const sorted = [...entries].sort((left, right) =>
    lowerIsBetter ? left.score - right.score : right.score - left.score
  );
  const ranks = new Map<string, number>();
  for (let index = 0; index < sorted.length; index += 1) {
    const entry = sorted[index]!;
    if (index > 0 && sorted[index - 1]!.score === entry.score) {
      ranks.set(entry.playerId, ranks.get(sorted[index - 1]!.playerId)!);
    } else {
      ranks.set(entry.playerId, index + 1);
    }
  }
  return ranks;
}

function pairwiseScore(rankA: number, rankB: number): number {
  if (rankA < rankB) {
    return 1;
  }
  if (rankA > rankB) {
    return 0;
  }
  return 0.5;
}

export function updateTeiMultiplayerPairwise(
  player: TeiRankedPlayer,
  table: readonly TeiRankedPlayer[]
): number {
  const opponents = table.filter((entry) => entry.playerId !== player.playerId);
  if (opponents.length === 0) {
    return player.tei;
  }

  const experience = player.unassistedMatches ?? 0;
  const k = kFactor(experience);
  const scale = k / opponents.length;
  let delta = 0;

  for (const opponent of opponents) {
    const score = pairwiseScore(player.rank, opponent.rank);
    delta += scale * (score - expectedEloScore(player.tei, opponent.tei));
  }

  return Math.round(player.tei + delta);
}

export function resolveEffectivePlayerTei(
  priorTei: number | undefined,
  unassistedMatches: number,
  startingTei?: number
): number {
  if (unassistedMatches > 0) {
    return priorTei ?? DEFAULT_UNASSISTED_TEI;
  }
  return priorTei ?? startingTei ?? DEFAULT_UNASSISTED_TEI;
}
