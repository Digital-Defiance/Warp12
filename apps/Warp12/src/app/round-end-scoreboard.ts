import {
  computeRoundPointDeltas,
  type GameState,
  type RoundState,
} from 'warp12-engine';

export interface RoundEndScoreRow {
  readonly id: string;
  readonly name: string;
  readonly points: number;
  /**
   * Online: public `handCounts` say this seat still held tiles, but the private
   * hand isn't mirrored yet — pip total is unknown until the hand arrives.
   */
  readonly pointsPending?: boolean;
}

/**
 * Per-captain rows for the points round-end table.
 *
 * Always includes every seat (humans and AI). Online clients often open this
 * overlay before remote hands arrive; treating missing hands as empty used to
 * yield +0 and — when zeros were filtered — hide AI officers who still held
 * tiles (especially after a human went out / won the round).
 */
export function buildRoundEndScoreRows(
  game: GameState,
  round: RoundState,
  options?: {
    readonly handCounts?: Readonly<Record<string, number>>;
  }
): RoundEndScoreRow[] {
  const namesById = new Map(
    game.captains.map((captain) => [captain.id, captain.displayName] as const)
  );
  const handCounts = options?.handCounts;
  return computeRoundPointDeltas(game, round).map((entry) => {
    const mirrored = (round.hands[entry.playerId] ?? []).length;
    const publicCount = handCounts?.[entry.playerId];
    const pointsPending =
      publicCount !== undefined && publicCount > 0 && mirrored === 0;
    return {
      id: entry.playerId,
      name: namesById.get(entry.playerId) ?? entry.playerId,
      points: entry.points,
      ...(pointsPending ? { pointsPending: true } : {}),
    };
  });
}

/** Winner(s) first, then lowest points (golf-style). */
export function sortRoundEndScoreRows(
  rows: readonly RoundEndScoreRow[],
  winnerIds: ReadonlySet<string>
): RoundEndScoreRow[] {
  return [...rows].sort((a, b) => {
    const aWin = winnerIds.has(a.id) ? 0 : 1;
    const bWin = winnerIds.has(b.id) ? 0 : 1;
    if (aWin !== bWin) {
      return aWin - bWin;
    }
    return a.points - b.points;
  });
}
