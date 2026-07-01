import type { AiSkillLevel } from './stats-schema.js';
import type { RatedObjective } from './stats-schema.js';

export const DEFAULT_UNASSISTED_TEI = 1000;

/** Fixed opponent reference TEI for penalty mode (200-point steps). */
export const AI_OPPONENT_TEI_POINTS: Record<AiSkillLevel, number> = {
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
    : AI_OPPONENT_TEI_POINTS[skill];
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
  return updateTeiScore(playerTei, opponentTei, score, k);
}

/** Fractional-score Elo update (head-to-head or pairwise component). */
export function updateTeiScore(
  playerTei: number,
  opponentTei: number,
  score: number,
  k: number
): number {
  const expected = expectedEloScore(playerTei, opponentTei);
  return Math.round(playerTei + k * (score - expected));
}

export interface TeiRankedPlayer {
  readonly playerId: string;
  /** Competition rank — 1 is best (winner / lowest points). */
  readonly rank: number;
  readonly tei: number;
  readonly unassistedMatches?: number;
}

/**
 * Competition ranks from sortable scores.
 * `lowerIsBetter: true` for points campaigns; false for go-out tile counts.
 */
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
    if (
      index > 0 &&
      sorted[index - 1]!.score === entry.score
    ) {
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

/** Multi-captain human TEI update — pairwise Elo (TEI spec §6.5). */
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

/** Convenience: head-to-head human match with automatic K from experience. */
export function updateTeiHeadToHead(
  playerTei: number,
  opponentTei: number,
  won: boolean,
  unassistedMatchesPlayed: number
): number {
  return updateTeiScore(
    playerTei,
    opponentTei,
    won ? 1 : 0,
    kFactor(unassistedMatchesPlayed)
  );
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
