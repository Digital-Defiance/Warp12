/**
 * Apply OpenSkill TEAM rating updates for Module Zeta squad matches.
 *
 * Mirrors `apply-human-tei.ts` / `apply-group-tei.ts` (pre-match snapshot +
 * per-player transaction), but calls `updateTeamRatings()` instead of the FFA
 * `updateFFARatings()`. Each squad member's **own** prior rating is read into
 * the snapshot table and fed to OpenSkill individually — never a squad
 * average — so OpenSkill's per-individual credit assignment within a team is
 * preserved (a strong veteran and a fresh teammate on the same winning squad
 * get different posteriors). See `libs/engine/src/lib/rating/update-team.spec.ts`.
 *
 * Gated by `SQUADRONS_RATING_CALIBRATED` (true after 2026-07-13 squad ordering cal)
 * — callers MUST check that flag before invoking this module.
 */

import { updateTeamRatings, type Team, type TeamMember } from 'warp12-engine';
import {
  objectiveToTrackKey,
  squadObjectiveRatingStats,
  startingRatingForObjective,
  type PlayerStatsDocument,
  type RatedObjective,
  type SquadRatingStats,
  type StoredRating,
} from './rated-match-schema.js';
import { toStoredRatingWithGrade } from './rating-types.js';

/** One squad member's pre-match snapshot row. */
export interface SquadRatedPlayer {
  readonly playerId: string;
  readonly squadId: string;
  /** Competition rank of the *squad* — 1 = winning squad. */
  readonly rank: number;
  readonly rating: StoredRating;
}

/** Build the pre-match squad rating table from squad rosters + ranks. */
export function buildSquadRatingTable(
  squads: readonly {
    squadId: string;
    memberIds: readonly string[];
    rank: number;
  }[],
  ratingByUid: ReadonlyMap<string, StoredRating>
): SquadRatedPlayer[] {
  const table: SquadRatedPlayer[] = [];
  for (const squad of squads) {
    for (const playerId of squad.memberIds) {
      table.push({
        playerId,
        squadId: squad.squadId,
        rank: squad.rank,
        rating:
          ratingByUid.get(playerId) ?? {
            mu: 25.0,
            sigma: 25.0 / 3,
            matches: 0,
            displayRating: 0.0,
          },
      });
    }
  }
  return table;
}

/**
 * Apply the squad rating update for one player, given the frozen pre-match
 * `table` (every squad's roster, ranks, and pre-match ratings). Re-reads only
 * `uid`'s own fresh Firestore rating to guard against a race with a concurrent
 * report of the same sector — every other member's rating comes from the
 * snapshot, exactly like `applyGroupRatingForPlayer` does for FFA.
 */
export function applySquadRatingForPlayer(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective,
  table: readonly SquadRatedPlayer[],
  uid: string
): {
  squadRating: SquadRatingStats;
  ratingBefore: StoredRating;
  ratingAfter: StoredRating;
  squadId: string;
  won: boolean;
  rank: number;
} | null {
  const player = table.find((entry) => entry.playerId === uid);
  if (!player) {
    return null;
  }

  const key = objectiveToTrackKey(objective);
  const prior = squadObjectiveRatingStats(doc, objective);
  const ratingBefore =
    prior.rating.matches > 0
      ? prior.rating
      : {
          mu: startingRatingForObjective(doc, objective)?.mu ?? 25.0,
          sigma: startingRatingForObjective(doc, objective)?.sigma ?? 25.0 / 3,
          matches: 0,
          displayRating: 0,
        };

  // Rebuild squads from the frozen table, substituting only uid's own fresh
  // prior — every squadmate and every opposing squad keeps the pre-match
  // snapshot value. Grouping preserves each member's OWN rating (no averaging).
  const squadIds = [...new Set(table.map((p) => p.squadId))];
  const teams: Team[] = squadIds.map((squadId) => {
    const members = table.filter((p) => p.squadId === squadId);
    return {
      teamId: squadId,
      rank: members[0]!.rank,
      members: members.map<TeamMember>((p) => ({
        playerId: p.playerId,
        rating:
          p.playerId === uid
            ? { mu: ratingBefore.mu, sigma: ratingBefore.sigma, matches: ratingBefore.matches }
            : { mu: p.rating.mu, sigma: p.rating.sigma, matches: p.rating.matches },
      })),
    };
  });

  const updated = updateTeamRatings(teams);
  const newRating = updated.get(uid);
  if (!newRating) {
    return null;
  }

  const ratingAfter = toStoredRatingWithGrade(
    { ...newRating, matches: ratingBefore.matches + 1 },
    ratingBefore
  );

  return {
    squadRating: {
      ...(doc?.squadRating ?? {}),
      [key]: {
        rating: ratingAfter,
        wins: prior.wins + (player.rank === 1 ? 1 : 0),
      },
    },
    ratingBefore,
    ratingAfter,
    squadId: player.squadId,
    won: player.rank === 1,
    rank: player.rank,
  };
}
