/**
 * Team rating updates — for Module Zeta (Squadron) team play.
 * Multiple captains per squad, ratings updated based on squad performance.
 */

import { updateRatings } from './openskill-adapter.js';
import type { PlayerRating } from './types.js';

export interface TeamMember {
  readonly playerId: string;
  readonly rating: PlayerRating;
}

export interface Team {
  readonly teamId: string; // squadronId in Module Zeta
  readonly members: readonly TeamMember[];
  readonly rank: number; // 1 = winning squad, 2 = second place squad, etc.
}

/**
 * Update ratings after a team game (Module Zeta squadrons).
 *
 * @param teams - Array of teams (squads) with members and final ranks
 * @returns Map of playerId → updated PlayerRating
 *
 * Each team member's individual rating is updated based on their squad's
 * performance. All members of the winning squad gain rating; all members
 * of losing squads lose rating.
 *
 * Example:
 * ```typescript
 * const teams = [
 *   {
 *     teamId: 'squad-alpha',
 *     members: [
 *       { playerId: 'alice', rating: { mu: 25, sigma: 8.33, matches: 0 } },
 *       { playerId: 'bob',   rating: { mu: 25, sigma: 8.33, matches: 0 } },
 *     ],
 *     rank: 1 // winning squad
 *   },
 *   {
 *     teamId: 'squad-beta',
 *     members: [
 *       { playerId: 'carol', rating: { mu: 25, sigma: 8.33, matches: 0 } },
 *       { playerId: 'dave',  rating: { mu: 25, sigma: 8.33, matches: 0 } },
 *     ],
 *     rank: 2 // losing squad
 *   }
 * ];
 * const updated = updateTeamRatings(teams);
 * // alice and bob gain rating, carol and dave lose rating
 * ```
 */
export function updateTeamRatings(
  teams: readonly Team[]
): Map<string, PlayerRating> {
  if (teams.length === 0) {
    return new Map();
  }

  // Validate: all teams must have at least one member
  for (const team of teams) {
    if (team.members.length === 0) {
      throw new Error(
        `Team ${team.teamId} has no members — cannot update ratings`
      );
    }
  }

  // Convert to OpenSkill format: each team is an array of member ratings
  const openskillTeams = teams.map((team) =>
    team.members.map((member) => member.rating)
  );
  const ranks = teams.map((team) => team.rank);

  // Run OpenSkill update
  const updatedTeams = updateRatings(openskillTeams, ranks);

  // Convert back to Map<playerId, rating>
  const results = new Map<string, PlayerRating>();
  teams.forEach((team, teamIdx) => {
    team.members.forEach((member, memberIdx) => {
      const updatedRating = updatedTeams[teamIdx]![memberIdx]!;
      results.set(member.playerId, updatedRating);
    });
  });

  return results;
}

/**
 * Convenience function for 2-team head-to-head (2v2, 3v3, etc.).
 */
export function updateTwoTeamMatch(
  winningTeam: { teamId: string; members: readonly TeamMember[] },
  losingTeam: { teamId: string; members: readonly TeamMember[] }
): Map<string, PlayerRating> {
  return updateTeamRatings([
    { ...winningTeam, rank: 1 },
    { ...losingTeam, rank: 2 },
  ]);
}
