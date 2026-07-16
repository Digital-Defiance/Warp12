import {
  type GameModuleConfig,
  type GameObjective,
  type GameState,
  getTeiDisplay,
  hasWarpedModules,
  SQUADRONS_RATING_CALIBRATED,
  updateFFARatings,
  type PlayerRating,
} from 'warp12-engine';

import { sectorStandings } from '../game/sector-outcome.js';
import { isAiCaptain } from '../game/ai-captain.js';
import type { FirestoreCaptain } from './schema.js';
import {
  emptyObjectiveRatingStats as emptyObjectiveTeiStats,
  objectiveToTrackKey as objectiveTeiKey,
  startingRatingForObjective as startingTeiForObjective,
  type HumanRatingStats as HumanTeiStats,
  type ObjectiveRatingStats as ObjectiveTeiStats,
  type PlayerStatsDocument,
  type RatedObjective,
  type StoredRating,
} from './stats-schema.js';

/** Player entry for FFA rating preview. */
export interface TeiRankedPlayer {
  playerId: string;
  rank: number;
  rating: StoredRating;
  matches: number;
}

export function isHumanOnlySector(
  captains: readonly Pick<FirestoreCaptain, 'id' | 'isAi'>[]
): boolean {
  const humans = captains.filter((captain) => !isAiCaptain(captain));
  return humans.length >= 2 && humans.length === captains.length;
}

const RATED_AI_SKILLS = ['ensign', 'lieutenant', 'commander'] as const;

export type OnlineRatingIneligibleReason =
  | 'casual'
  | 'objective_not_rated'
  | 'not_enough_humans'
  | 'unrated_participant'
  | 'unrated_ai'
  | 'exhibition_set'
  | 'squadrons_not_calibrated'
  | 'warped_modules';

export interface OnlineRatingEligibility {
  readonly rated: boolean;
  readonly reason?: OnlineRatingIneligibleReason;
  /** Unverified (guest) human captains blocking rating, by id. */
  readonly unratedCaptainIds: readonly string[];
}

type EligibilityCaptain = Pick<
  FirestoreCaptain,
  'id' | 'isAi' | 'skill' | 'verified'
> & { class1Star?: boolean; omega?: boolean };

/**
 * Whether a completed/lobby online sector qualifies for human-pool TEI under
 * context B: two or more verified humans, and any AI seats are Ensign–Commander
 * anchors (no Ω / Class I* / other neural opponents). Mirrors the authoritative server
 * gate in `functions/src/online-match-eligibility.ts`; the lobby uses it to warn
 * captains before launch.
 *
 * Warp 9 / 15 / 18 are exhibition-only. Warped modules never rate. Module Zeta
 * writes the dedicated squadRating track when `SQUADRONS_RATING_CALIBRATED`.
 */
export function onlineMatchRatingEligibility(
  captains: readonly EligibilityCaptain[],
  objective: GameObjective,
  rated = true,
  maxPip = 12,
  modules?: GameModuleConfig | null
): OnlineRatingEligibility {
  if (!rated) {
    return { rated: false, reason: 'casual', unratedCaptainIds: [] };
  }
  if (maxPip !== 12) {
    return { rated: false, reason: 'exhibition_set', unratedCaptainIds: [] };
  }
  if (objective !== 'go-out' && objective !== 'points') {
    return { rated: false, reason: 'objective_not_rated', unratedCaptainIds: [] };
  }
  if (hasWarpedModules(modules)) {
    return { rated: false, reason: 'warped_modules', unratedCaptainIds: [] };
  }
  if (modules?.squadrons === true && !SQUADRONS_RATING_CALIBRATED) {
    return {
      rated: false,
      reason: 'squadrons_not_calibrated',
      unratedCaptainIds: [],
    };
  }

  const humans = captains.filter((captain) => !isAiCaptain(captain));
  const ais = captains.filter((captain) => isAiCaptain(captain));

  if (humans.length < 2) {
    return { rated: false, reason: 'not_enough_humans', unratedCaptainIds: [] };
  }

  const unratedCaptainIds = humans
    .filter((captain) => captain.verified !== true)
    .map((captain) => captain.id);
  if (unratedCaptainIds.length > 0) {
    return { rated: false, reason: 'unrated_participant', unratedCaptainIds };
  }

  const hasUnratedAi = ais.some(
    (captain) =>
      captain.class1Star === true ||
      (captain.skill !== undefined &&
        !RATED_AI_SKILLS.includes(captain.skill as (typeof RATED_AI_SKILLS)[number]))
  );
  if (hasUnratedAi) {
    return { rated: false, reason: 'unrated_ai', unratedCaptainIds: [] };
  }

  return { rated: true, unratedCaptainIds: [] };
}

/** Post-match explanation (including play-time reasons like advisor use). */
export function onlineUnratedNotice(reason: string | undefined): string {
  switch (reason) {
    case 'casual':
      return 'Casual sector — this game was not played for TEI.';
    case 'advisor_used':
      return 'Unrated sector — the tactical advisor was consulted during play. TEI is earned only in unassisted matches.';
    case 'unrated_participant':
      return 'Unrated sector — a captain played as a guest. Sign in with an account to earn TEI.';
    case 'unrated_ai':
      return 'Unrated sector — an experimental Class I* officer was aboard. TEI is rated only against Ensign–Commander AI.';
    case 'objective_not_rated':
      return 'Unrated sector — this objective does not affect TEI.';
    case 'not_enough_humans':
      return 'Unrated sector — rated matches need at least two signed-in captains.';
    case 'charter_mismatch':
      return 'Unrated sector — sector settings do not match the crew charter (fleet size, objective, or rules).';
    case 'exhibition_set':
      return 'Exhibition sector — Warp 9 / 15 / 18 do not update TEI. Play Warp 12 for rated ladders.';
    case 'warped_modules':
      return 'Exhibition sector — a Warped module (Epsilon / Kappa / Lambda) was aboard. TEI stays off.';
    case 'squadrons_not_calibrated':
      return 'Unrated sector — Module Zeta (Squadrons) squad TEI is temporarily gated.';
    default:
      return 'This sector was unrated.';
  }
}

/** Lobby-facing explanation for why a sector will not be rated. */
export function onlineRatingWarning(
  eligibility: OnlineRatingEligibility,
  captains: readonly Pick<FirestoreCaptain, 'id' | 'displayName'>[]
): string | null {
  if (eligibility.rated) {
    return null;
  }
  switch (eligibility.reason) {
    case 'casual':
      return 'Casual sector — TEI is off for this game. Free comms open.';
    case 'objective_not_rated':
      return 'This objective is not rated — TEI will not change.';
    case 'not_enough_humans':
      return 'Rated sectors need at least two signed-in captains. This match will be unrated.';
    case 'exhibition_set':
      return 'Exhibition set — Warp 9 / 15 / 18 are unrated. TEI ladders are Warp 12 only.';
    case 'warped_modules':
      return 'Warped module aboard (Epsilon / Kappa / Lambda) — exhibition only; TEI stays off.';
    case 'squadrons_not_calibrated':
      return 'Module Zeta (Squadrons) — squad TEI is temporarily gated.';
    case 'unrated_participant': {
      const names = eligibility.unratedCaptainIds
        .map((id) => captains.find((c) => c.id === id)?.displayName ?? 'a guest')
        .join(', ');
      return `Unrated match — ${names} ${
        eligibility.unratedCaptainIds.length > 1 ? 'are' : 'is'
      } playing as a guest. Sign in with an account to earn TEI.`;
    }
    case 'unrated_ai':
      return 'Unrated match — an Ω or other experimental officer is aboard. TEI is only rated against Ensign–Commander AI.';
    default:
      return 'This match will be unrated.';
  }
}

export function humanCaptainsInSector(
  captains: readonly FirestoreCaptain[]
): FirestoreCaptain[] {
  return captains.filter((captain) => !isAiCaptain(captain));
}

export function humanObjectiveTeiStats(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): ObjectiveTeiStats {
  const key = objectiveTeiKey(objective);
  const humanRating = doc?.humanRating?.[key];
  if (!humanRating) {
    return emptyObjectiveTeiStats();
  }
  return humanRating;
}

/** Module Zeta: squad-play rating stats (parallel to humanObjectiveTeiStats). */
export function squadObjectiveTeiStats(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): ObjectiveTeiStats {
  const key = objectiveTeiKey(objective);
  const squadRating = doc?.squadRating?.[key];
  if (!squadRating) {
    return emptyObjectiveTeiStats();
  }
  return squadRating;
}

export function displayHumanObjectiveTei(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): number | null {
  const track = humanObjectiveTeiStats(doc, objective);
  if (track.rating.matches <= 0) {
    const seed = startingTeiForObjective(doc ?? null, objective);
    if (seed) {
      // Use conservative estimate: μ - 3σ
      return Math.max(0, seed.mu - 3 * seed.sigma);
    }
    return null;
  }
  return track.rating.displayRating;
}

export function hasRatedHumanSector(
  doc: PlayerStatsDocument | null | undefined,
  gameId: string
): boolean {
  return doc?.humanRatedGameIds?.includes(gameId) ?? false;
}

/** Build competition ranks for a completed human-only sector. */
export function buildHumanSectorRankTable(
  game: GameState,
  humanUids: readonly string[],
  ratingByUid: ReadonlyMap<string, { rating: StoredRating; matches: number }>
): TeiRankedPlayer[] | null {
  if (game.phase !== 'complete') {
    return null;
  }

  const standings = sectorStandings(game, {});
  
  // Build rank map (1-indexed for winners, ties get same rank)
  const rankMap = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < standings.length; i++) {
    const standing = standings[i]!;
    
    // Check if this player tied with previous
    if (i > 0 && standings[i - 1]!.value === standing.value) {
      rankMap.set(standing.id, rankMap.get(standings[i - 1]!.id)!);
    } else {
      rankMap.set(standing.id, currentRank);
    }
    currentRank++;
  }

  // Build table for human players only
  return humanUids
    .map((uid) => {
      const rank = rankMap.get(uid);
      if (rank === undefined) {
        return null;
      }
      
      const ratingData = ratingByUid.get(uid);
      const rating = ratingData?.rating ?? {
        mu: 25.0,
        sigma: 8.33,
        matches: 0,
        displayRating: 0.0,
        displayGrade: 'P00',
      };
      const matches = ratingData?.matches ?? 0;

      return {
        playerId: uid,
        rank,
        rating,
        matches,
      };
    })
    .filter((entry): entry is TeiRankedPlayer => entry !== null);
}

export interface HumanTeiSelfUpdate {
  readonly ratingBefore: StoredRating;
  readonly ratingAfter: StoredRating;
  readonly rank: number;
  readonly won: boolean;
}

/** 
 * Preview rating change for one captain (client-side only).
 * Mirrors the server-side logic in apply-human-tei.ts.
 */
export function applyHumanTeiSelfUpdate(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective,
  table: readonly TeiRankedPlayer[],
  uid: string
): {
  humanTei: HumanTeiStats;
  update: HumanTeiSelfUpdate;
} | null {
  const player = table.find((entry) => entry.playerId === uid);
  if (!player) {
    return null;
  }

  const key = objectiveTeiKey(objective);
  const prior = humanObjectiveTeiStats(doc, objective);
  
  // Resolve effective rating (use starting rating if no matches)
  let ratingBefore: StoredRating;
  if (prior.rating.matches > 0) {
    ratingBefore = prior.rating;
  } else {
    const seed = startingTeiForObjective(doc, objective);
    if (seed) {
      ratingBefore = {
        mu: seed.mu,
        sigma: seed.sigma,
        matches: 0,
        displayRating: Math.max(0, seed.mu - 3 * seed.sigma),
        displayGrade: getTeiDisplay({ mu: seed.mu, sigma: seed.sigma, matches: 0 }).grade,
      };
    } else {
      // Default rating
      ratingBefore = {
        mu: 25.0,
        sigma: 8.33,
        matches: 0,
        displayRating: 0.0,
        displayGrade: 'P',
      };
    }
  }

  // Build player list for OpenSkill FFA update
  const players: Array<{ playerId: string; rating: PlayerRating; rank: number }> =
    table.map((p) => ({
      playerId: p.playerId,
      rating: {
        mu: p.playerId === uid ? ratingBefore.mu : p.rating.mu,
        sigma: p.playerId === uid ? ratingBefore.sigma : p.rating.sigma,
        matches: p.playerId === uid ? ratingBefore.matches : p.rating.matches,
      },
      rank: p.rank,
    }));

  // Update ratings using OpenSkill FFA
  const updatedRatings = updateFFARatings(players);
  const newRating = updatedRatings.get(uid);

  if (!newRating) {
    return null;
  }

  // Apply display rating and grade with hysteresis
  const ratingAfter: StoredRating = {
    mu: newRating.mu,
    sigma: newRating.sigma,
    matches: ratingBefore.matches + 1,
    displayRating: newRating.mu - 3 * newRating.sigma,
    displayGrade: getTeiDisplay(
      newRating,
      ratingBefore.displayGrade
    ).grade,
  };

  return {
    humanTei: {
      ...(doc?.humanRating ?? {}),
      [key]: {
        rating: ratingAfter,
        wins: prior.wins + (player.rank === 1 ? 1 : 0),
      },
    },
    update: {
      ratingBefore,
      ratingAfter,
      won: player.rank === 1,
      rank: player.rank,
    },
  };
}
