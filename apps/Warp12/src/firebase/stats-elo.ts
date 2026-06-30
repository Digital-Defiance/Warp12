import type { AiSkillLevel } from './stats-schema.js';
import type { RatedObjective } from './stats-schema.js';

export const DEFAULT_UNASSISTED_TEI = 1000;

/** Fixed opponent reference TEI for penalty mode (200-point steps). */
export const AI_OPPONENT_TEI_PENALTY: Record<AiSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1200,
  commander: 1400,
};

/** Wider steps for go-out — races are noisier; percentile handles display. */
export const AI_OPPONENT_TEI_GO_OUT: Record<AiSkillLevel, number> = {
  ensign: 1000,
  lieutenant: 1250,
  commander: 1500,
};

export function opponentTeiForObjective(
  objective: RatedObjective,
  skill: AiSkillLevel
): number {
  return objective === 'go-out'
    ? AI_OPPONENT_TEI_GO_OUT[skill]
    : AI_OPPONENT_TEI_PENALTY[skill];
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

export function updateUnassistedTei(
  playerTei: number,
  opponentTei: number,
  score: 0 | 1,
  k: number
): number {
  const expected = expectedEloScore(playerTei, opponentTei);
  return Math.round(playerTei + k * (score - expected));
}

/** TEI used before/at the first rated game in a bucket. */
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

export function displayUnassistedTei(
  tei: number | undefined,
  unassistedMatches: number
): number | null {
  if (unassistedMatches <= 0) {
    return null;
  }
  return tei ?? DEFAULT_UNASSISTED_TEI;
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
