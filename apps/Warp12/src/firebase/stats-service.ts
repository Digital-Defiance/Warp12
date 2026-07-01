import { doc, getDoc, runTransaction } from 'firebase/firestore';

import {
  type GameObjective,
  type GameState,
  WARP_SKILL_LEVELS,
  type WarpSkillLevel,
} from 'warp12-engine';

import { getFirebaseAuth, getFirestoreDb, isFirebaseConfigured } from './config.js';
import { callFunction } from './functions-client.js';
import {
  dequeuePendingLocalAiMatch,
  enqueuePendingLocalAiMatch,
  isNetworkAvailable,
  listPendingLocalAiMatches,
  pendingLocalAiMatchCount as countPendingLocalAiMatches,
  pruneNonReplayablePendingLocalAiMatches,
} from '../game/offline-match-queue.js';
import {
  filterHumanActionsForReplay,
  getLocalAiMatchRejectReason,
  isReplayableLocalAiMatch,
  localAiMatchRejectNotice,
} from '../game/local-ai-match-validation.js';
export type { LocalAiMatchRejectReason } from '../game/local-ai-match-validation.js';
export {
  getLocalAiMatchRejectReason,
  isReplayableLocalAiMatch,
  localAiMatchRejectNotice,
} from '../game/local-ai-match-validation.js';
import {
  DEFAULT_UNASSISTED_TEI,
  kFactor,
  opponentTeiForObjective,
  resolveEffectivePlayerTei,
  updateUnassistedTei,
} from './stats-elo.js';
import {
  appendMatchHistory,
  type MatchHistoryEntry,
} from './match-history.js';
import { humanObjectiveTeiStats } from './human-tei.js';

import type { CaptainGender } from '../game/captain-profile.js';
import type { FirestoreCaptain } from './schema.js';
import {
  emptyLocalAiSkillStats,
  objectiveTeiKey,
  objectiveTeiStats,
  startingTeiForObjective,
  type LocalAiSkillStats,
  type PlayerStatsDocument,
  type RatedObjective,
} from './stats-schema.js';

const PLAYER_STATS = 'playerStats';

/** Firestore rejects explicit `undefined` in documents. */
export function stripUndefinedFieldsForFirestore<T extends Record<string, unknown>>(
  value: T
): T {
  const next = { ...value };
  for (const key of Object.keys(next)) {
    const field = next[key];
    if (field === undefined) {
      delete next[key];
      continue;
    }
    if (key === 'matchHistory' && Array.isArray(field)) {
      next[key] = field.map((entry) =>
        stripUndefinedFieldsForFirestore(entry as Record<string, unknown>)
      );
    }
  }
  return next;
}

export interface ReportLocalAiMatchInput {
  uid: string;
  displayName: string;
  skill: WarpSkillLevel;
  opponentClass1Star?: boolean;
  objective: RatedObjective;
  advisorUsed: boolean;
  decisionPct?: number;
  decisionGrade?: string;
  seed: number;
  config: import('../game/local-game-config.js').LocalGameConfig;
  humanActions: import('warp12-engine').GameAction[];
}

export interface LocalAiMatchReport {
  rated: boolean;
  won: boolean;
  advisorUsed: boolean;
  objective: RatedObjective;
  skill: WarpSkillLevel;
  teiBefore: number | null;
  teiAfter: number | null;
  teiDelta: number | null;
}

export type LocalAiMatchOutcome = Pick<
  ReportLocalAiMatchInput,
  'advisorUsed' | 'skill' | 'objective'
> & { won: boolean };

export type LocalAiMatchSubmitResult =
  | { status: 'uploaded'; report: LocalAiMatchReport }
  | { status: 'queued' }
  | { status: 'skipped'; reason: 'not_configured' | 'not_replayable'; notice?: string };

export interface OnlineHumanSelfReport {
  rated: boolean;
  won: boolean;
  advisorUsed: boolean;
  objective: RatedObjective;
  humanPool: true;
  rank: number;
  teiBefore: number | null;
  teiAfter: number | null;
  teiDelta: number | null;
}

export interface ReportOnlineHumanSelfInput {
  uid: string;
  displayName: string;
  gameId: string;
  game: GameState;
  onlineCaptains: readonly FirestoreCaptain[];
  advisorUsed: boolean;
}

export { startingTeiForObjective } from './stats-schema.js';

export function incrementLocalAiSkillStats(
  current: LocalAiSkillStats,
  input: LocalAiMatchOutcome,
  options?: { startingTei?: number }
): LocalAiSkillStats {
  const next: LocalAiSkillStats = {
    ...current,
    matchesCompleted: current.matchesCompleted + 1,
    matchesWon: current.matchesWon + (input.won ? 1 : 0),
    advisorMatches: current.advisorMatches + (input.advisorUsed ? 1 : 0),
    advisorWins:
      current.advisorWins + (input.advisorUsed && input.won ? 1 : 0),
  };

  if (!input.advisorUsed) {
    const key = objectiveTeiKey(input.objective);
    const prior = objectiveTeiStats(current, input.objective);
    const teiBefore = resolveEffectivePlayerTei(
      prior.unassistedTei,
      prior.unassistedMatches,
      options?.startingTei
    );
    next[key] = {
      unassistedMatches: prior.unassistedMatches + 1,
      unassistedWins: prior.unassistedWins + (input.won ? 1 : 0),
      unassistedTei: updateUnassistedTei(
        teiBefore,
        opponentTeiForObjective(input.objective, input.skill),
        input.won ? 1 : 0,
        kFactor(prior.unassistedMatches)
      ),
    };
  }

  return next;
}

export function previewLocalAiMatchReport(
  current: LocalAiSkillStats,
  input: ReportLocalAiMatchInput,
  won: boolean,
  startingTei?: number
): LocalAiMatchReport {
  if (input.advisorUsed) {
    return {
      rated: false,
      won,
      advisorUsed: true,
      objective: input.objective,
      skill: input.skill,
      teiBefore: null,
      teiAfter: null,
      teiDelta: null,
    };
  }

  const prior = objectiveTeiStats(current, input.objective);
  const teiBefore = resolveEffectivePlayerTei(
    prior.unassistedTei,
    prior.unassistedMatches,
    startingTei
  );
  const teiAfter = updateUnassistedTei(
    teiBefore,
    opponentTeiForObjective(input.objective, input.skill),
    won ? 1 : 0,
    kFactor(prior.unassistedMatches)
  );

  return {
    rated: true,
    won,
    advisorUsed: false,
    objective: input.objective,
    skill: input.skill,
    teiBefore,
    teiAfter,
    teiDelta: teiAfter - teiBefore,
  };
}

export function ratedObjective(objective: GameObjective): RatedObjective | null {
  return objective === 'go-out' || objective === 'points' ? objective : null;
}

export async function fetchPlayerStats(
  uid: string
): Promise<PlayerStatsDocument | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }
  const db = getFirestoreDb();
  if (!db) {
    return null;
  }
  const snap = await getDoc(doc(db, PLAYER_STATS, uid));
  if (!snap.exists()) {
    return null;
  }
  return snap.data() as PlayerStatsDocument;
}

export async function saveCaptainGender(
  uid: string,
  captainGender: CaptainGender
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const now = new Date().toISOString();
  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;

    tx.set(
      ref,
      {
        uid,
        ...(existing?.displayName ? {} : { displayName: 'Captain' }),
        captainGender,
        updatedAt: now,
      },
      { merge: true }
    );
  });
}

export async function setAcademyPlacement(
  uid: string,
  objective: RatedObjective,
  skill: WarpSkillLevel
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }

  const auth = getFirebaseAuth();
  if (!auth?.currentUser || auth.currentUser.uid !== uid) {
    throw new Error('Sign in required to save academy placement.');
  }
  await auth.currentUser.getIdToken(true);

  await callFunction<
    { objective: RatedObjective; skill: WarpSkillLevel },
    { ok: boolean; tei: number }
  >('setAcademyPlacement', { objective, skill });
}

function isRetriableNetworkError(error: unknown): boolean {
  if (!isNetworkAvailable()) {
    return true;
  }
  const code =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code: unknown }).code === 'string'
      ? (error as { code: string }).code
      : null;
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'internal' ||
    (error instanceof TypeError && /fetch|network/i.test(error.message))
  );
}

async function uploadLocalAiMatch(
  input: ReportLocalAiMatchInput
): Promise<LocalAiMatchReport> {
  const humanActions = filterHumanActionsForReplay(input.humanActions);
  const result = await callFunction<
    Omit<ReportLocalAiMatchInput, 'uid'>,
    {
      rated: boolean;
      won: boolean;
      teiBefore: number | null;
      teiAfter: number | null;
      teiDelta: number | null;
    }
  >('reportPracticeAiMatch', {
    displayName: input.displayName,
    skill: input.skill,
    opponentClass1Star: input.opponentClass1Star,
    objective: input.objective,
    advisorUsed: input.advisorUsed,
    decisionPct: input.decisionPct,
    decisionGrade: input.decisionGrade,
    seed: input.seed,
    config: input.config,
    humanActions,
  });

  return {
    rated: result.rated,
    won: result.won,
    advisorUsed: input.advisorUsed,
    objective: input.objective,
    skill: input.skill,
    teiBefore: result.teiBefore,
    teiAfter: result.teiAfter,
    teiDelta: result.teiDelta,
  };
}

export function pendingLocalAiMatchCount(uid?: string): number {
  return countPendingLocalAiMatches(uid);
}

/** Upload queued offline vs-AI reports when connectivity returns. */
export async function flushPendingLocalAiMatches(uid: string): Promise<number> {
  if (!isFirebaseConfigured() || !isNetworkAvailable()) {
    return 0;
  }

  pruneNonReplayablePendingLocalAiMatches(uid);

  let synced = 0;
  for (const entry of listPendingLocalAiMatches(uid)) {
    if (!isNetworkAvailable()) {
      break;
    }
    if (!isReplayableLocalAiMatch(entry)) {
      dequeuePendingLocalAiMatch(entry.matchKey);
      continue;
    }
    try {
      await uploadLocalAiMatch(entry);
      dequeuePendingLocalAiMatch(entry.matchKey);
      synced += 1;
    } catch (error) {
      if (isRetriableNetworkError(error)) {
        break;
      }
      dequeuePendingLocalAiMatch(entry.matchKey);
    }
  }
  return synced;
}

export async function reportLocalAiMatch(
  input: ReportLocalAiMatchInput,
  matchKey: string
): Promise<LocalAiMatchSubmitResult> {
  if (!isFirebaseConfigured()) {
    return { status: 'skipped', reason: 'not_configured' };
  }

  const rejectReason = getLocalAiMatchRejectReason(input);
  if (rejectReason) {
    return {
      status: 'skipped',
      reason: 'not_replayable',
      notice: localAiMatchRejectNotice(rejectReason),
    };
  }

  if (!isNetworkAvailable()) {
    enqueuePendingLocalAiMatch(input, matchKey);
    return { status: 'queued' };
  }

  try {
    const report = await uploadLocalAiMatch(input);
    return { status: 'uploaded', report };
  } catch (error) {
    if (isRetriableNetworkError(error)) {
      enqueuePendingLocalAiMatch(input, matchKey);
      return { status: 'queued' };
    }
    throw error;
  }
}

/** @deprecated Human-pool TEI uses officiated rated matches on the leaderboard. */
export async function reportOnlineHumanSelfTei(
  input: ReportOnlineHumanSelfInput
): Promise<OnlineHumanSelfReport | null> {
  void input;
  return null;
}

export function displayPlayerObjectiveTei(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): number | null {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    const seed = startingTeiForObjective(stats, objective);
    return seed ?? null;
  }
  const trackStats = objectiveTeiStats(bucket, objective);
  if (trackStats.unassistedMatches > 0) {
    return trackStats.unassistedTei ?? DEFAULT_UNASSISTED_TEI;
  }
  return (
    trackStats.unassistedTei ??
    startingTeiForObjective(stats, objective) ??
    null
  );
}

export function hasStartingTeiPlacedForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  const key = objectiveTeiKey(objective);
  return stats?.startingTei?.[key] !== undefined;
}

export function hasAnyRatedUnassistedMatchForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  if (!stats?.localAi) {
    return false;
  }
  for (const skill of WARP_SKILL_LEVELS) {
    const bucket = stats.localAi[skill];
    if (!bucket) {
      continue;
    }
    if (objectiveTeiStats(bucket, objective).unassistedMatches > 0) {
      return true;
    }
  }
  return false;
}

export function hasAnyRatedUnassistedMatch(
  stats: PlayerStatsDocument | null
): boolean {
  return (
    hasAnyRatedUnassistedMatchForObjective(stats, 'go-out') ||
    hasAnyRatedUnassistedMatchForObjective(stats, 'points')
  );
}

export function needsAcademyPlacementForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  if (hasStartingTeiPlacedForObjective(stats, objective)) {
    return false;
  }
  if (hasAnyRatedUnassistedMatchForObjective(stats, objective)) {
    return false;
  }
  const humanTrack = humanObjectiveTeiStats(stats, objective);
  return humanTrack.unassistedMatches === 0;
}

export function needsAcademyPlacement(
  stats: PlayerStatsDocument | null
): boolean {
  return (
    needsAcademyPlacementForObjective(stats, 'go-out') ||
    needsAcademyPlacementForObjective(stats, 'points')
  );
}

export function canSetStartingTei(
  stats: PlayerStatsDocument | null,
  _skill: WarpSkillLevel,
  objective: RatedObjective
): boolean {
  return needsAcademyPlacementForObjective(stats, objective);
}
