import type { GameState } from 'warp12-engine';

import { sectorStandings } from '../game/sector-outcome.js';
import { isAiCaptain } from '../game/ai-captain.js';
import type { FirestoreCaptain } from './schema.js';
import {
  rankCompetition,
  DEFAULT_UNASSISTED_TEI,
  resolveEffectivePlayerTei,
  updateTeiMultiplayerPairwise,
  type TeiRankedPlayer,
} from './stats-elo.js';
import {
  emptyObjectiveTeiStats,
  objectiveTeiKey,
  startingTeiForObjective,
  type HumanTeiStats,
  type ObjectiveTeiStats,
  type PlayerStatsDocument,
  type RatedObjective,
} from './stats-schema.js';

export function isHumanOnlySector(
  captains: readonly Pick<FirestoreCaptain, 'id' | 'isAi'>[]
): boolean {
  const humans = captains.filter((captain) => !isAiCaptain(captain));
  return humans.length >= 2 && humans.length === captains.length;
}

export function humanCaptainsInSector(
  captains: readonly FirestoreCaptain[]
): FirestoreCaptain[] {
  return captains.filter((captain) => !isAiCaptain(captain));
}

export function humanObjectiveTeiStats(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): ObjectiveTeiStats {
  const key = objectiveTeiKey(objective);
  return { ...emptyObjectiveTeiStats(), ...doc?.humanTei?.[key] };
}

export function displayHumanObjectiveTei(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): number | null {
  const track = humanObjectiveTeiStats(doc, objective);
  if (track.unassistedMatches <= 0) {
    const seed = startingTeiForObjective(doc ?? null, objective);
    return seed ?? null;
  }
  return track.unassistedTei ?? DEFAULT_UNASSISTED_TEI;
}

export function hasRatedHumanSector(
  doc: PlayerStatsDocument | null | undefined,
  gameId: string
): boolean {
  return doc?.humanRatedGameIds?.includes(gameId) ?? false;
}

/** Build competition ranks for a completed human-only sector. */
export function buildHumanSectorRankTable(
  game: GameState,
  humanUids: readonly string[],
  teiByUid: ReadonlyMap<string, { tei: number; matches: number }>
): TeiRankedPlayer[] | null {
  if (game.phase !== 'complete' || humanUids.length < 2) {
    return null;
  }

  const standings = sectorStandings(game, Object.fromEntries(
    humanUids.map((uid) => [uid, uid])
  ));
  const scoreByUid = new Map(
    standings
      .filter((row) => humanUids.includes(row.id))
      .map((row) => [row.id, row.value])
  );

  if (scoreByUid.size < humanUids.length) {
    return null;
  }

  const lowerIsBetter = game.objective !== 'go-out' ? true : true;
  const ranks = rankCompetition(
    humanUids.map((uid) => ({
      playerId: uid,
      score: scoreByUid.get(uid) ?? Number.MAX_SAFE_INTEGER,
    })),
    lowerIsBetter
  );

  return humanUids.map((uid) => ({
    playerId: uid,
    rank: ranks.get(uid) ?? humanUids.length,
    tei: teiByUid.get(uid)?.tei ?? DEFAULT_UNASSISTED_TEI,
    unassistedMatches: teiByUid.get(uid)?.matches ?? 0,
  }));
}

export interface HumanTeiSelfUpdate {
  readonly teiBefore: number;
  readonly teiAfter: number;
  readonly rank: number;
  readonly won: boolean;
}

/** Apply pairwise TEI update for one captain (TEI spec §6.5). */
export function applyHumanTeiSelfUpdate(
  doc: PlayerStatsDocument | null,
  objective: RatedObjective,
  table: readonly TeiRankedPlayer[],
  uid: string
): {
  humanTei: HumanTeiStats;
  update: HumanTeiSelfUpdate;
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
    update: {
      teiBefore,
      teiAfter,
      rank: player.rank,
      won: player.rank === 1,
    },
  };
}
