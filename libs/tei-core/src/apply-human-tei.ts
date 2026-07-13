import {
  humanObjectiveTeiStats,
  objectiveTeiKey,
  startingTeiForObjective,
  type HumanTeiStats,
  type PlayerStatsDocument,
  type RatedMatchDocument,
  type RatedObjective,
} from './rated-match-schema.js';
import {
  resolveEffectivePlayerTei,
  updateTeiMultiplayerPairwise,
  type TeiRankedPlayer,
} from './stats-openskill.js';

export function buildTeiTableFromStandings(
  match: RatedMatchDocument,
  teiByUid: ReadonlyMap<string, { tei: number; matches: number }>
): TeiRankedPlayer[] {
  return match.standings.map((row) => ({
    playerId: row.uid,
    rank: row.rank,
    tei: teiByUid.get(row.uid)?.tei ?? 1000,
    unassistedMatches: teiByUid.get(row.uid)?.matches ?? 0,
  }));
}

export function applyHumanTeiForPlayer(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective,
  table: readonly TeiRankedPlayer[],
  uid: string
): {
  humanTei: HumanTeiStats;
  teiBefore: number;
  teiAfter: number;
  won: boolean;
  rank: number;
} | null {
  const player = table.find((entry) => entry.playerId === uid);
  if (!player) {
    return null;
  }

  const key = objectiveTeiKey(objective);
  const prior = humanObjectiveTeiStats(doc, objective);
  const teiBefore = resolveEffectivePlayerTei(
    prior.unassistedTei,
    prior.unassistedMatches,
    startingTeiForObjective(doc, objective)
  );
  const playerRow: TeiRankedPlayer = { ...player, tei: teiBefore };
  const tableWithCurrent = table.map((entry) =>
    entry.playerId === uid ? playerRow : entry
  );
  const teiAfter = updateTeiMultiplayerPairwise(playerRow, tableWithCurrent);

  return {
    humanTei: {
      ...(doc?.humanTei ?? {}),
      [key]: {
        unassistedMatches: prior.unassistedMatches + 1,
        unassistedWins: prior.unassistedWins + (player.rank === 1 ? 1 : 0),
        unassistedTei: teiAfter,
      },
    },
    teiBefore,
    teiAfter,
    won: player.rank === 1,
    rank: player.rank,
  };
}
