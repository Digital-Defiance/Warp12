/**
 * Module Zeta: Fleet Squadrons — team formation + shared-trail resolution.
 *
 * Model C: squads share one trail via a canonical `trailKey`. `trailKeyFor`
 * maps any captain to their squad's trail key; in FFA it is the identity. All
 * engine trail access (legal moves, beacon, apply-action) routes through
 * `trailKeyFor` / `sameTrailGroup` so squad members transparently share a
 * single trail entry and beacon.
 */
import type { RoundState } from '../types/game-state.js';
import type { PlayerId } from '../types/player.js';
import type { Squadron } from '../types/squadrons.js';

export interface FormSquadronsResult {
  readonly squadrons: readonly Squadron[];
  /**
   * Turn order interleaved so squadmates never sit consecutively ("bridge
   * seating" — teammates alternate with opposing squads). Round-robin across
   * squads: squad0[0], squad1[0], ..., squad0[1], squad1[1], ...
   */
  readonly turnOrder: readonly PlayerId[];
}

function assertSquadronSize(squadronSize: number): void {
  if (squadronSize < 2 || squadronSize > 3) {
    throw new RangeError(
      `Squadron size must be 2 or 3 (got ${squadronSize}).`
    );
  }
}

function bridgeSeatTurnOrder(
  squadrons: readonly Squadron[],
  squadronSize: number
): PlayerId[] {
  const turnOrder: PlayerId[] = [];
  for (let slot = 0; slot < squadronSize; slot++) {
    for (const squad of squadrons) {
      turnOrder.push(squad.memberIds[slot]);
    }
  }
  return turnOrder;
}

function buildNamedSquadrons(
  members: readonly (readonly PlayerId[])[],
  squadronNames?: readonly (string | undefined)[]
): Squadron[] {
  return members.map((memberIds, i) => {
    const name = squadronNames?.[i]?.trim();
    return {
      id: `squad-${i + 1}`,
      memberIds,
      trailKey: memberIds[0],
      ...(name ? { name } : {}),
    };
  });
}

/**
 * Divide captains into equal squads and build interleaved (bridge) seating.
 *
 * @param captainIds  Captains in their lobby/seat order (used for round-robin
 *   when `explicitRosters` is omitted).
 * @param squadronSize 2–3 captains per squad.
 * @param squadronNames Optional host-chosen names, index-aligned with
 *   formation order (squad 0's name, squad 1's name, ...). Blank/missing
 *   entries leave that squad unnamed (falls back to "Squad N" on display).
 * @param explicitRosters Optional host-assigned membership. Each inner array
 *   is one squad of exactly `squadronSize` ids; together they must equal
 *   `captainIds` as a set (no duplicates, no extras). When omitted, captains
 *   are dealt round-robin (legacy auto-formation).
 * @throws RangeError when the fleet cannot divide into ≥2 equal squads, or
 *   when explicit rosters are incomplete/invalid.
 */
export function formSquadrons(
  captainIds: readonly PlayerId[],
  squadronSize: number,
  squadronNames?: readonly (string | undefined)[],
  explicitRosters?: readonly (readonly PlayerId[])[]
): FormSquadronsResult {
  assertSquadronSize(squadronSize);

  if (explicitRosters !== undefined) {
    return formSquadronsFromExplicitRosters(
      captainIds,
      squadronSize,
      explicitRosters,
      squadronNames
    );
  }

  if (captainIds.length < squadronSize * 2) {
    throw new RangeError(
      `Need at least ${squadronSize * 2} captains for 2 squads of ${squadronSize}.`
    );
  }
  if (captainIds.length % squadronSize !== 0) {
    throw new RangeError(
      `Fleet of ${captainIds.length} does not divide evenly into squads of ${squadronSize}.`
    );
  }

  const squadCount = captainIds.length / squadronSize;
  const members: PlayerId[][] = Array.from({ length: squadCount }, () => []);

  // Deal captains round-robin into squads so consecutive seats land on
  // different squads (this also yields the interleaved turn order below).
  captainIds.forEach((id, index) => {
    members[index % squadCount].push(id);
  });

  const squadrons = buildNamedSquadrons(members, squadronNames);
  return {
    squadrons,
    turnOrder: bridgeSeatTurnOrder(squadrons, squadronSize),
  };
}

/** Validate and form from host-assigned rosters (drag-roster path). */
export function formSquadronsFromExplicitRosters(
  captainIds: readonly PlayerId[],
  squadronSize: number,
  explicitRosters: readonly (readonly PlayerId[])[],
  squadronNames?: readonly (string | undefined)[]
): FormSquadronsResult {
  assertSquadronSize(squadronSize);

  if (explicitRosters.length < 2) {
    throw new RangeError('Need at least 2 squads.');
  }
  for (const roster of explicitRosters) {
    if (roster.length !== squadronSize) {
      throw new RangeError(
        `Each squad must have exactly ${squadronSize} captains (got ${roster.length}).`
      );
    }
  }

  const expected = new Set(captainIds);
  const seen = new Set<PlayerId>();
  for (const roster of explicitRosters) {
    for (const id of roster) {
      if (!expected.has(id)) {
        throw new RangeError(
          `Squad roster includes captain "${id}" who is not in the fleet.`
        );
      }
      if (seen.has(id)) {
        throw new RangeError(`Captain "${id}" appears in more than one squad.`);
      }
      seen.add(id);
    }
  }
  if (seen.size !== expected.size) {
    const missing = [...expected].filter((id) => !seen.has(id));
    throw new RangeError(
      `Squad rosters omit captain(s): ${missing.join(', ')}.`
    );
  }

  const squadrons = buildNamedSquadrons(explicitRosters, squadronNames);
  return {
    squadrons,
    turnOrder: bridgeSeatTurnOrder(squadrons, squadronSize),
  };
}

/**
 * Keep host-assigned rosters in sync when the lobby roster or squadron size
 * changes. Preserves extant assignments where possible; places newcomers into
 * underfilled squads; falls back to auto round-robin when sizes cannot be
 * reconciled.
 */
export function reconcileSquadronRosters(
  captainIds: readonly PlayerId[],
  squadronSize: number,
  existing?: readonly (readonly PlayerId[])[] | null
): PlayerId[][] | null {
  if (
    squadronSize < 2 ||
    squadronSize > 3 ||
    captainIds.length < squadronSize * 2 ||
    captainIds.length % squadronSize !== 0
  ) {
    return null;
  }

  const squadCount = captainIds.length / squadronSize;
  const present = new Set(captainIds);

  if (!existing || existing.length === 0) {
    const { squadrons } = formSquadrons(captainIds, squadronSize);
    return squadrons.map((s) => [...s.memberIds]);
  }

  let rosters = existing
    .map((roster) => roster.filter((id) => present.has(id)))
    .filter((roster) => roster.length > 0);

  while (rosters.length > squadCount) {
    const overflow = rosters.pop()!;
    for (const id of overflow) {
      const target = rosters.reduce(
        (best, r, i) => (r.length < rosters[best].length ? i : best),
        0
      );
      rosters[target] = [...rosters[target], id];
    }
  }
  while (rosters.length < squadCount) {
    rosters.push([]);
  }

  const assigned = new Set(rosters.flat());
  const orphans = captainIds.filter((id) => !assigned.has(id));
  for (const id of orphans) {
    const target = rosters.reduce(
      (best, r, i) => (r.length < rosters[best].length ? i : best),
      0
    );
    rosters[target] = [...rosters[target], id];
  }

  if (rosters.some((r) => r.length !== squadronSize)) {
    const { squadrons } = formSquadrons(captainIds, squadronSize);
    return squadrons.map((s) => [...s.memberIds]);
  }

  return rosters.map((r) => [...r]);
}

/** Squad a captain belongs to, or null in FFA / when not on a squad. */
export function squadronForPlayer(
  squadrons: readonly Squadron[] | undefined,
  playerId: PlayerId
): Squadron | null {
  if (!squadrons) {
    return null;
  }
  return squadrons.find((s) => s.memberIds.includes(playerId)) ?? null;
}

/**
 * Canonical trail key for a captain. In squads this is the squad's shared
 * `trailKey`; in FFA it is the captain's own id (identity — no behavior
 * change).
 */
export function trailKeyFor(round: RoundState, playerId: PlayerId): PlayerId {
  const squad = squadronForPlayer(round.squadrons, playerId);
  return squad ? squad.trailKey : playerId;
}

/**
 * Whether two captains share a trail (same squad), i.e. `b`'s trail is `a`'s
 * "own" trail for legality and beacon purposes. In FFA this is `a === b`.
 */
export function sameTrailGroup(
  round: RoundState,
  a: PlayerId,
  b: PlayerId
): boolean {
  return trailKeyFor(round, a) === trailKeyFor(round, b);
}

/** Display name for a squad — the host's chosen name, or "Squad N" (1-indexed). */
export function squadronDisplayName(
  squadrons: readonly Squadron[],
  squad: Squadron
): string {
  if (squad.name) {
    return squad.name;
  }
  const index = squadrons.findIndex((s) => s.id === squad.id);
  return `Squad ${index + 1}`;
}

/** All captain ids that share the given captain's trail (incl. self). */
export function trailGroupMembers(
  round: RoundState,
  playerId: PlayerId
): readonly PlayerId[] {
  const squad = squadronForPlayer(round.squadrons, playerId);
  return squad ? squad.memberIds : [playerId];
}

/**
 * Whether a chart route targets the acting captain's own (possibly shared
 * squad) trail. Use this instead of comparing `route.playerId === playerId`
 * directly — a squadmate's own-trail move resolves to the squad's `trailKey`,
 * which may differ from their own id. Identity in FFA.
 */
export function routeIsOwnTrail(
  round: RoundState,
  playerId: PlayerId,
  route: { readonly kind: string; readonly playerId?: PlayerId }
): boolean {
  return (
    route.kind === 'warp-trail' &&
    route.playerId !== undefined &&
    sameTrailGroup(round, playerId, route.playerId)
  );
}

/**
 * Rank squads by an aggregate per-squad score (points: lower is better;
 * go-out: pass a score where the winning squad already sorts first, e.g. -1
 * for the winner and remaining hand size for everyone else).
 *
 * Pure and rating-agnostic — used both to rank a live squad round and, for
 * Module Zeta rating (5.4), to rank finished squad matches from a Firestore
 * game document without re-deriving squad membership server-side.
 *
 * @param squadMemberIds  Map of squadId → member player ids.
 * @param scoreByPlayer   Map of playerId → score for members of that squad.
 * @param lowerIsBetter   True for points (lower cumulative pips wins).
 * @returns Map of squadId → competition rank (1 = best; ties share a rank).
 */
export function rankSquads(
  squadMemberIds: ReadonlyMap<string, readonly PlayerId[]>,
  scoreByPlayer: ReadonlyMap<PlayerId, number>,
  lowerIsBetter = true
): Map<string, number> {
  const squadScores: { squadId: string; score: number }[] = [];
  for (const [squadId, memberIds] of squadMemberIds) {
    // All members of a squad carry the same aggregate score by convention
    // (see scoring.ts tallyRoundPoints), but average defensively in case a
    // caller passes per-member scores that haven't been aggregated yet.
    const scores = memberIds
      .map((id) => scoreByPlayer.get(id))
      .filter((s): s is number => s !== undefined);
    const score =
      scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    squadScores.push({ squadId, score });
  }

  squadScores.sort((a, b) => (lowerIsBetter ? a.score - b.score : b.score - a.score));

  const ranks = new Map<string, number>();
  squadScores.forEach((entry, index) => {
    if (index > 0 && squadScores[index - 1].score === entry.score) {
      ranks.set(entry.squadId, ranks.get(squadScores[index - 1].squadId)!);
    } else {
      ranks.set(entry.squadId, index + 1);
    }
  });
  return ranks;
}
