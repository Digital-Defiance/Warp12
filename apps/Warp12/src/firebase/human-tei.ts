import type { GameObjective, GameState } from 'warp12-engine';

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

const RATED_AI_SKILLS = ['ensign', 'lieutenant', 'commander'] as const;

export type OnlineRatingIneligibleReason =
  | 'casual'
  | 'objective_not_rated'
  | 'not_enough_humans'
  | 'unrated_participant'
  | 'unrated_ai';

export interface OnlineRatingEligibility {
  readonly rated: boolean;
  readonly reason?: OnlineRatingIneligibleReason;
  /** Unverified (guest) human captains blocking rating, by id. */
  readonly unratedCaptainIds: readonly string[];
}

type EligibilityCaptain = Pick<
  FirestoreCaptain,
  'id' | 'isAi' | 'skill' | 'verified'
> & { class1Star?: boolean; omega?: boolean };

/**
 * Whether a completed/lobby online sector qualifies for human-pool TEI under
 * context B: two or more verified humans, and any AI seats are Class II–IV
 * anchors (no Class Ω / Class I* / other neural opponents). Mirrors the authoritative server
 * gate in `functions/src/report-online-match.ts`; the lobby uses it to warn
 * captains before launch.
 */
export function onlineMatchRatingEligibility(
  captains: readonly EligibilityCaptain[],
  objective: GameObjective,
  rated = true
): OnlineRatingEligibility {
  if (!rated) {
    return { rated: false, reason: 'casual', unratedCaptainIds: [] };
  }
  if (objective !== 'go-out' && objective !== 'points') {
    return { rated: false, reason: 'objective_not_rated', unratedCaptainIds: [] };
  }

  const humans = captains.filter((captain) => !isAiCaptain(captain));
  const ais = captains.filter((captain) => isAiCaptain(captain));

  if (humans.length < 2) {
    return { rated: false, reason: 'not_enough_humans', unratedCaptainIds: [] };
  }

  const unratedCaptainIds = humans
    .filter((captain) => captain.verified !== true)
    .map((captain) => captain.id);
  if (unratedCaptainIds.length > 0) {
    return { rated: false, reason: 'unrated_participant', unratedCaptainIds };
  }

  const hasUnratedAi = ais.some(
    (captain) =>
      captain.class1Star === true ||
      (captain.skill !== undefined &&
        !RATED_AI_SKILLS.includes(captain.skill as (typeof RATED_AI_SKILLS)[number]))
  );
  if (hasUnratedAi) {
    return { rated: false, reason: 'unrated_ai', unratedCaptainIds: [] };
  }

  return { rated: true, unratedCaptainIds: [] };
}

/** Post-match explanation (including play-time reasons like advisor use). */
export function onlineUnratedNotice(reason: string | undefined): string {
  switch (reason) {
    case 'casual':
      return 'Casual sector — this game was not played for TEI.';
    case 'advisor_used':
      return 'Unrated sector — the tactical advisor was consulted during play. TEI is earned only in unassisted matches.';
    case 'unrated_participant':
      return 'Unrated sector — a captain played as a guest. Sign in with an account to earn TEI.';
    case 'unrated_ai':
      return 'Unrated sector — an experimental Class I* officer was aboard. TEI is rated only against Class II–IV AI.';
    case 'objective_not_rated':
      return 'Unrated sector — this objective does not affect TEI.';
    case 'not_enough_humans':
      return 'Unrated sector — rated matches need at least two signed-in captains.';
    case 'charter_mismatch':
      return 'Unrated sector — sector settings do not match the crew charter (fleet size, objective, or rules).';
    default:
      return 'This sector was unrated.';
  }
}

/** Lobby-facing explanation for why a sector will not be rated. */
export function onlineRatingWarning(
  eligibility: OnlineRatingEligibility,
  captains: readonly Pick<FirestoreCaptain, 'id' | 'displayName'>[]
): string | null {
  if (eligibility.rated) {
    return null;
  }
  switch (eligibility.reason) {
    case 'casual':
      return 'Casual sector — TEI is off for this game. Free comms open.';
    case 'objective_not_rated':
      return 'This objective is not rated — TEI will not change.';
    case 'not_enough_humans':
      return 'Rated sectors need at least two signed-in captains. This match will be unrated.';
    case 'unrated_participant': {
      const names = eligibility.unratedCaptainIds
        .map((id) => captains.find((c) => c.id === id)?.displayName ?? 'a guest')
        .join(', ');
      return `Unrated match — ${names} ${
        eligibility.unratedCaptainIds.length > 1 ? 'are' : 'is'
      } playing as a guest. Sign in with an account to earn TEI.`;
    }
    case 'unrated_ai':
      return 'Unrated match — a Class Ω or other experimental officer is aboard. TEI is only rated against Class II–IV AI.';
    default:
      return 'This match will be unrated.';
  }
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
