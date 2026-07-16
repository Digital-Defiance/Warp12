import type { GameState } from 'warp12-engine';

/** Per-round campaign point deltas for one round, keyed by captain id. */
export interface CampaignRoundPoints {
  readonly roundNumber: number;
  readonly deltas: Readonly<Record<string, number>>;
}

/** A round-start snapshot (as collected for advisor reports). */
export interface CampaignRoundSnapshot {
  readonly roundNumber: number;
  readonly roundStartState: GameState;
}

/**
 * Derive per-round campaign point deltas from the round-start snapshots we
 * already keep for advisor reports: each snapshot's cumulative `pointsScore`
 * minus the next round's start gives that round's delta (the final game closes
 * the last round). No separate history tracking required.
 *
 * Snapshots may arrive out of order or with gaps (e.g. an online spectator who
 * joined mid-campaign); they are sorted by round number and each delta is scoped
 * to the captains present in the final game.
 */
export function deriveCampaignPointsHistory(
  snapshots: readonly CampaignRoundSnapshot[],
  finalGame: GameState
): CampaignRoundPoints[] {
  const sorted = [...snapshots].sort((a, b) => a.roundNumber - b.roundNumber);
  const pointsOf = (state: GameState) =>
    new Map(state.captains.map((captain) => [captain.id, captain.pointsScore]));
  return sorted.map((snapshot, index) => {
    const start = pointsOf(snapshot.roundStartState);
    const end =
      index + 1 < sorted.length
        ? pointsOf(sorted[index + 1].roundStartState)
        : pointsOf(finalGame);
    const deltas: Record<string, number> = {};
    for (const captain of finalGame.captains) {
      deltas[captain.id] =
        (end.get(captain.id) ?? 0) - (start.get(captain.id) ?? 0);
    }
    return { roundNumber: snapshot.roundNumber, deltas };
  });
}
