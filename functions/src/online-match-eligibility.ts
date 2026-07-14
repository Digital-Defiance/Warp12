/**
 * Pure (no Firebase) online-match rating eligibility + ranking logic.
 *
 * Extracted from `report-online-match.ts` so this can be unit-tested directly
 * with vitest without needing to mock `firebase-admin` (that module calls
 * `admin.firestore()` at load time).
 */
import {
  hasWarpedModules,
  rankSquads,
  SQUADRONS_RATING_CALIBRATED,
  type GameModuleConfig,
} from 'warp12-engine';
import { rankCompetition, type AiSkillLevel } from './tei/stats-openskill';

const AI_ID_PREFIX = 'ai:';
export const AI_SKILL_LEVELS: readonly AiSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

/** Minimal view of the shared game document — only fields rating needs. */
export interface GameCaptainDoc {
  id: string;
  displayName: string;
  pointsScore?: number;
  isAi?: boolean;
  skill?: string;
  class1Star?: boolean;
  /** Module Zeta: squadron this captain belongs to. */
  squadronId?: string;
}

/** Module Zeta: a squad roster, mirrored from `GameState.squadrons`. */
export interface GameSquadronDoc {
  id: string;
  memberIds: string[];
  name?: string;
}

export interface GameRoundDoc {
  roundWinnerId?: string | null;
  handCounts?: Record<string, number>;
}

export interface GameDoc {
  id: string;
  phase: string;
  objective: string;
  rated?: boolean;
  /** Double-N max pip. Omitted = 12 (legacy). */
  maxPip?: number;
  campaignRounds?: number;
  charterId?: string;
  rulesProfileId?: string;
  modules?: GameModuleConfig;
  houseRules?: Record<string, boolean | number | undefined>;
  captains: GameCaptainDoc[];
  round?: GameRoundDoc | null;
  /** Module Zeta: squad rosters, present only when squadrons are enabled. */
  squadrons?: GameSquadronDoc[];
}

/** Whether this sector was played with Module Zeta squadrons. */
export function isSquadGame(
  game: Pick<GameDoc, 'modules' | 'squadrons'>
): boolean {
  return game.modules?.squadrons === true && (game.squadrons?.length ?? 0) > 0;
}

/** Outcome of the eligibility gate — a match is either rated or explained. */
export type OnlineRatingEligibility =
  | { rated: true }
  | { rated: false; reason: OnlineRatingIneligibleReason };

export type OnlineRatingIneligibleReason =
  | 'casual'
  | 'objective_not_rated'
  | 'not_enough_humans'
  | 'class1_star_present'
  | 'unrated_ai'
  | 'exhibition_set'
  | 'squadrons_not_calibrated'
  | 'warped_modules';

export function isAiGameCaptain(captain: GameCaptainDoc): boolean {
  return captain.isAi === true || captain.id.startsWith(AI_ID_PREFIX);
}

export function aiSkill(captain: GameCaptainDoc): AiSkillLevel {
  return (AI_SKILL_LEVELS as readonly string[]).includes(captain.skill ?? '')
    ? (captain.skill as AiSkillLevel)
    : 'lieutenant';
}

/**
 * Verify the roster is rateable under context B (humans anchored against Class
 * II–IV AI). Human verification (non-anonymous accounts) is checked separately
 * against Firebase Auth — this covers only what the game document itself tells us.
 */
export function evaluateOnlineRatingEligibility(
  game: Pick<GameDoc, 'objective' | 'captains' | 'rated' | 'maxPip' | 'modules' | 'squadrons'>
): OnlineRatingEligibility {
  if (game.rated === false) {
    return { rated: false, reason: 'casual' };
  }
  if ((game.maxPip ?? 12) !== 12) {
    return { rated: false, reason: 'exhibition_set' };
  }
  if (game.objective !== 'go-out' && game.objective !== 'points') {
    return { rated: false, reason: 'objective_not_rated' };
  }
  // Warped modules (Epsilon drafting, Kappa temporal inversion, Lambda wormholes)
  // never update TEI — exhibition / party only (tei-spec E8).
  if (hasWarpedModules(game.modules)) {
    return { rated: false, reason: 'warped_modules' };
  }
  // Module Zeta: play normally, but never rate, until 5.6 calibration
  // confirms squad play preserves skill ordering (see anchors.ts).
  if (isSquadGame(game) && !SQUADRONS_RATING_CALIBRATED) {
    return { rated: false, reason: 'squadrons_not_calibrated' };
  }

  const humans = game.captains.filter((c) => !isAiGameCaptain(c));
  const ais = game.captains.filter(isAiGameCaptain);

  if (humans.length < 2) {
    return { rated: false, reason: 'not_enough_humans' };
  }

  for (const ai of ais) {
    if (ai.class1Star === true) {
      return { rated: false, reason: 'class1_star_present' };
    }
    if (ai.skill !== undefined && !AI_SKILL_LEVELS.includes(ai.skill as AiSkillLevel)) {
      return { rated: false, reason: 'unrated_ai' };
    }
  }

  return { rated: true };
}

/** Competition ranks across the full table (humans + AI), 1 = best. */
export function computeOnlineRanks(game: GameDoc): Map<string, number> {
  if (game.objective === 'go-out') {
    const winner = game.round?.roundWinnerId ?? null;
    const handCounts = game.round?.handCounts ?? {};
    return rankCompetition(
      game.captains.map((c) => ({
        playerId: c.id,
        // Winner sorts strictly ahead; the rest by tiles remaining (fewer = better).
        score: c.id === winner ? -1 : handCounts[c.id] ?? Number.MAX_SAFE_INTEGER,
      })),
      true
    );
  }

  return rankCompetition(
    game.captains.map((c) => ({ playerId: c.id, score: c.pointsScore ?? 0 })),
    true
  );
}

/**
 * Rank squads (Module Zeta), 1 = best, using the engine's pure `rankSquads`.
 * Go-out: the winner's squad gets score -1 (sorts first); everyone else uses
 * remaining hand size, matching `computeOnlineRanks`' go-out convention.
 * Points: each member already stores the squad's aggregate `pointsScore`
 * (see `scoring.ts` `tallyRoundPoints`), so any member's score represents
 * the whole squad.
 */
export function computeOnlineSquadRanks(game: GameDoc): Map<string, number> {
  const squads = game.squadrons ?? [];
  const squadMemberIds = new Map(
    squads.map((s) => [s.id, s.memberIds] as const)
  );

  const scoreByPlayer = new Map<string, number>();
  if (game.objective === 'go-out') {
    const winner = game.round?.roundWinnerId ?? null;
    const handCounts = game.round?.handCounts ?? {};
    for (const captain of game.captains) {
      scoreByPlayer.set(
        captain.id,
        captain.id === winner ? -1 : handCounts[captain.id] ?? Number.MAX_SAFE_INTEGER
      );
    }
  } else {
    for (const captain of game.captains) {
      scoreByPlayer.set(captain.id, captain.pointsScore ?? 0);
    }
  }

  return rankSquads(squadMemberIds, scoreByPlayer, true);
}
