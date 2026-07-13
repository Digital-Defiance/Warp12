/**
 * Apply OpenSkill rating updates for human vs human matches.
 */

import { updateFFARatings, type PlayerRating } from 'warp12-engine';
import {
  humanObjectiveRatingStats,
  objectiveToTrackKey,
  startingRatingForObjective,
  type HumanRatingStats,
  type PlayerStatsDocument,
  type RatedMatchDocument,
  type RatedObjective,
  type StoredRating,
} from './rated-match-schema.js';
import {
  resolveEffectivePlayerRating,
  type RatedPlayer,
} from './stats-openskill.js';
import { toStoredRatingWithGrade } from './rating-types.js';

export function buildRatingTableFromStandings(
  match: RatedMatchDocument,
  ratingByUid: ReadonlyMap<
    string,
    { rating: StoredRating; matches: number }
  >
): RatedPlayer[] {
  return match.standings.map((row) => ({
    playerId: row.uid,
    rank: row.rank,
    rating:
      ratingByUid.get(row.uid)?.rating ?? {
        mu: 25.0,
        sigma: 25.0 / 3,
        matches: 0,
        displayRating: 0.0,
      },
  }));
}

export function applyHumanRatingForPlayer(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective,
  table: readonly RatedPlayer[],
  uid: string
): {
  humanRating: HumanRatingStats;
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
  const prior = humanObjectiveRatingStats(doc, objective);
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

  return {
    humanRating: {
      ...(doc?.humanRating ?? {}),
      [key]: {
        rating: ratingAfter,
        wins: prior.wins + (player.rank === 1 ? 1 : 0),
      },
    },
    ratingBefore,
    ratingAfter,
    won: player.rank === 1,
    rank: player.rank,
  };
}

