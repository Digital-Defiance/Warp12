/**
 * Module Zeta: durable squad-vs-squad match archive (`squadMatches/{gameId}`).
 * Written by Cloud Functions only; profile `matchHistory` remains the personal TEI feed.
 */

export interface SquadMatchSquadEntry {
  readonly id: string;
  readonly memberIds: readonly string[];
  readonly rank: number;
  readonly name?: string;
  readonly memberDisplayNames: readonly string[];
}

export interface SquadMatchArchiveDoc {
  readonly gameId: string;
  readonly playedAt: string;
  readonly objective: 'points' | 'go-out';
  readonly maxPip: number;
  readonly rated: true;
  readonly charterId?: string;
  /** Flat membership for `array-contains` queries from the profile. */
  readonly memberUids: readonly string[];
  readonly squadrons: readonly SquadMatchSquadEntry[];
  readonly winnerSquadIds: readonly string[];
}

export function buildSquadMatchArchive(input: {
  gameId: string;
  playedAt: string;
  objective: 'points' | 'go-out';
  maxPip?: number;
  charterId?: string;
  captains: readonly { id: string; displayName: string }[];
  squadrons: readonly {
    id: string;
    memberIds: readonly string[];
    name?: string;
  }[];
  squadRanks: ReadonlyMap<string, number>;
}): SquadMatchArchiveDoc {
  const nameById = new Map(
    input.captains.map((c) => [c.id, c.displayName] as const)
  );
  const squadrons: SquadMatchSquadEntry[] = input.squadrons.map((s) => {
    const rank = input.squadRanks.get(s.id) ?? input.squadrons.length;
    return {
      id: s.id,
      memberIds: [...s.memberIds],
      rank,
      ...(s.name ? { name: s.name } : {}),
      memberDisplayNames: s.memberIds.map(
        (id) => nameById.get(id) ?? id
      ),
    };
  });
  const bestRank = Math.min(...squadrons.map((s) => s.rank));
  const winnerSquadIds = squadrons
    .filter((s) => s.rank === bestRank)
    .map((s) => s.id);
  const memberUids = [
    ...new Set(input.squadrons.flatMap((s) => [...s.memberIds])),
  ];

  return {
    gameId: input.gameId,
    playedAt: input.playedAt,
    objective: input.objective,
    maxPip: input.maxPip ?? 12,
    rated: true,
    ...(input.charterId ? { charterId: input.charterId } : {}),
    memberUids,
    squadrons,
    winnerSquadIds,
  };
}
