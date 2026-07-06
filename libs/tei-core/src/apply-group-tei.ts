import type { GroupTeiByCharter, GroupTeiStats } from './charter-schema.js';
import {
  charterHouseRulesMatch,
  charterModulesMatch,
  type CharterHouseRulesInput,
  type CharterModulesInput,
} from './charter-lobby-config.js';
import {
  objectiveTeiKey,
  startingTeiForObjective,
  type PlayerStatsDocument,
  type RatedObjective,
} from './rated-match-schema.js';
import {
  resolveEffectivePlayerTei,
  updateTeiMultiplayerPairwise,
  type TeiRankedPlayer,
} from './stats-elo.js';

function activeGroupBucket(
  doc: PlayerStatsDocument | null | undefined,
  charterId: string,
  charterSeasonKey?: string
): GroupTeiStats | undefined {
  const bucket = doc?.groupTei?.[charterId];
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

export function groupObjectiveTeiStats(
  doc: PlayerStatsDocument | null | undefined,
  charterId: string,
  objective: RatedObjective,
  charterSeasonKey?: string
): import('./rated-match-schema.js').ObjectiveTeiStats {
  const key = objectiveTeiKey(objective);
  const bucket = activeGroupBucket(doc, charterId, charterSeasonKey);
  return {
    unassistedMatches: 0,
    unassistedWins: 0,
    ...bucket?.[key],
  };
}

export function applyGroupTeiForPlayer(
  doc: PlayerStatsDocument | null,
  charterId: string,
  objective: RatedObjective,
  table: readonly TeiRankedPlayer[],
  uid: string,
  charterSeasonKey?: string
): {
  groupTei: GroupTeiByCharter;
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
  const prior = groupObjectiveTeiStats(
    doc,
    charterId,
    objective,
    charterSeasonKey
  );
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

  const sameSeasonBucket = activeGroupBucket(doc, charterId, charterSeasonKey) ?? {};
  const charterBucket: GroupTeiStats = {
    ...sameSeasonBucket,
    seasonKey: charterSeasonKey ?? sameSeasonBucket.seasonKey,
    [key]: {
      unassistedMatches: prior.unassistedMatches + 1,
      unassistedWins: prior.unassistedWins + (player.rank === 1 ? 1 : 0),
      unassistedTei: teiAfter,
    },
  };

  return {
    groupTei: {
      ...(doc?.groupTei ?? {}),
      [charterId]: charterBucket,
    },
    teiBefore,
    teiAfter,
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
