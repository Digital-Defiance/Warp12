/**
 * Apply OpenSkill rating updates for charter/crew matches.
 */

import { updateFFARatings, type PlayerRating } from 'warp12-engine';
import type { GroupTeiByCharter, GroupTeiStats } from './charter-schema.js';
import {
  charterHouseRulesMatch,
  charterModulesMatch,
  type CharterHouseRulesInput,
  type CharterModulesInput,
} from './charter-lobby-config.js';
import {
  objectiveToTrackKey,
  startingRatingForObjective,
  type PlayerStatsDocument,
  type RatedObjective,
  type StoredRating,
  type ObjectiveRatingStats,
} from './rated-match-schema.js';
import {
  resolveEffectivePlayerRating,
  type RatedPlayer,
} from './stats-openskill.js';
import { emptyObjectiveRatingStats, toStoredRatingWithGrade } from './rating-types.js';

function activeGroupBucket(
  doc: PlayerStatsDocument | null | undefined,
  charterId: string,
  charterSeasonKey?: string
): GroupTeiStats | undefined {
  const bucket = doc?.groupRating?.[charterId];
  if (!bucket) {
    return undefined;
  }
  if (
    charterSeasonKey &&
    bucket.seasonKey &&
    bucket.seasonKey !== charterSeasonKey
  ) {
    return undefined;
  }
  return bucket;
}

export function groupObjectiveRatingStats(
  doc: PlayerStatsDocument | null | undefined,
  charterId: string,
  objective: RatedObjective,
  charterSeasonKey?: string
): ObjectiveRatingStats {
  const key = objectiveToTrackKey(objective);
  const bucket = activeGroupBucket(doc, charterId, charterSeasonKey);
  const existing = bucket?.[key];
  return existing ?? emptyObjectiveRatingStats();
}

export function applyGroupRatingForPlayer(
  doc: PlayerStatsDocument | null,
  charterId: string,
  objective: RatedObjective,
  table: readonly RatedPlayer[],
  uid: string,
  charterSeasonKey?: string
): {
  groupRating: GroupTeiByCharter;
  ratingBefore: StoredRating;
  ratingAfter: StoredRating;
  won: boolean;
  rank: number;
} | null {
  const player = table.find((entry) => entry.playerId === uid);
  if (!player) {
    return null;
  }

  const key = objectiveToTrackKey(objective);
  const prior = groupObjectiveRatingStats(
    doc,
    charterId,
    objective,
    charterSeasonKey
  );
  const ratingBefore = resolveEffectivePlayerRating(
    prior.rating,
    prior.rating.matches,
    startingRatingForObjective(doc, objective)
  );

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

  const ratingAfter = toStoredRatingWithGrade(
    {
      ...newRating,
      matches: ratingBefore.matches + 1,
    },
    ratingBefore // Pass previous rating for hysteresis
  );

  const sameSeasonBucket =
    activeGroupBucket(doc, charterId, charterSeasonKey) ?? {};
  const charterBucket: GroupTeiStats = {
    ...sameSeasonBucket,
    seasonKey: charterSeasonKey ?? sameSeasonBucket.seasonKey,
    [key]: {
      rating: ratingAfter,
      wins: prior.wins + (player.rank === 1 ? 1 : 0),
    },
  };

  return {
    groupRating: {
      ...(doc?.groupRating ?? {}),
      [charterId]: charterBucket,
    },
    ratingBefore,
    ratingAfter,
    won: player.rank === 1,
    rank: player.rank,
  };
}

export function charterMatchesRatedEvent(
  charter: {
    objective: RatedObjective;
    playerCount: number;
    rulesProfileId: string;
    campaignRounds: number;
    modules?: CharterModulesInput;
    houseRules?: CharterHouseRulesInput;
  },
  event: {
    objective: RatedObjective;
    playerCount: number;
    rulesProfileId: string;
    campaignRounds: number;
    modules?: CharterModulesInput;
    houseRules?: CharterHouseRulesInput;
  }
): boolean {
  return (
    charter.objective === event.objective &&
    charter.playerCount === event.playerCount &&
    charter.rulesProfileId === event.rulesProfileId &&
    charter.campaignRounds === event.campaignRounds &&
    charterModulesMatch(charter, event.modules ?? {}) &&
    charterHouseRulesMatch(charter, event.houseRules ?? {})
  );
}

