import type { AiSkillLevel } from './stats-schema.js';
import type { RatedObjective } from './stats-schema.js';

export const DEFAULT_UNASSISTED_ELO = 1000;

/** Fixed opponent ratings for penalty mode (200-point steps). */
export const AI_OPPONENT_ELO_PENALTY: Record<AiSkillLevel, number> = {
  beginner: 1000,
  intermediate: 1200,
  advanced: 1400,
};

/** Wider steps for go-out — races are noisier; percentile handles display. */
export const AI_OPPONENT_ELO_GO_OUT: Record<AiSkillLevel, number> = {
  beginner: 1000,
  intermediate: 1250,
  advanced: 1500,
};

/** @deprecated Use {@link opponentEloForObjective} */
export const AI_OPPONENT_ELO = AI_OPPONENT_ELO_PENALTY;

/** Keep aligned with libs/engine REFERENCE_AI_ELO / GO_OUT_REFERENCE_AI_ELO. */

export function opponentEloForObjective(
  objective: RatedObjective,
  skill: AiSkillLevel
): number {
  return objective === 'go-out'
    ? AI_OPPONENT_ELO_GO_OUT[skill]
    : AI_OPPONENT_ELO_PENALTY[skill];
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
  playerElo: number,
  opponentElo: number
): number {
  return 1 / (1 + 10 ** ((opponentElo - playerElo) / 400));
}

export function updateUnassistedElo(
  playerElo: number,
  opponentElo: number,
  score: 0 | 1,
  k: number
): number {
  const expected = expectedEloScore(playerElo, opponentElo);
  return Math.round(playerElo + k * (score - expected));
}

/** ELO used before/at the first rated game in a bucket. */
export function resolveEffectivePlayerElo(
  priorElo: number | undefined,
  unassistedMatches: number,
  startingElo?: number
): number {
  if (unassistedMatches > 0) {
    return priorElo ?? DEFAULT_UNASSISTED_ELO;
  }
  return priorElo ?? startingElo ?? DEFAULT_UNASSISTED_ELO;
}

export function displayUnassistedElo(
  elo: number | undefined,
  unassistedMatches: number
): number | null {
  if (unassistedMatches <= 0) {
    return null;
  }
  return elo ?? DEFAULT_UNASSISTED_ELO;
}

/** Top X% among rated captains (rank 1 of 25 → Top 4%). */
export function formatTopPercentile(rank: number, total: number): string {
  if (total <= 0) {
    return '—';
  }
  if (total === 1) {
    return 'Top 100%';
  }
  const pct = Math.max(1, Math.min(100, Math.round((rank / total) * 100)));
  return `Top ${pct}%`;
}
