import { doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';

import {
  type GameObjective,
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
import type { CaptainGender } from '../game/captain-profile.js';
import type { CaptainPronounPreference } from '../game/captain-pronouns.js';
import { sanitizeSpeakAs } from '../game/captain-speak-as.js';
export type { LocalAiMatchRejectReason } from '../game/local-ai-match-validation.js';
export {
  getLocalAiMatchRejectReason,
  isReplayableLocalAiMatch,
  localAiMatchRejectNotice,
} from '../game/local-ai-match-validation.js';
import {
  DEFAULT_RATING,
  getTeiDisplay,
  getAIAnchor,
  updateVsAI,
  type PlayerRating,
  type TeiGrade,
} from 'warp12-engine';
import { isRatedLocalGame } from '../game/local-game-config.js';
import {
  objectiveRatingStats as objectiveTeiStats,
  startingRatingForObjective,
  type LocalAiSkillStats,
  type PlayerStatsDocument,
  type RatedObjective,
} from './stats-schema.js';
import { objectiveToTrackKey, cacheDisplayRating, type StoredRating } from './rating-types.js';

const PLAYER_STATS = 'playerStats';
const PLAYER_PROFILES = 'playerProfiles';

/**
 * Keep federation `playerProfiles` in sync with Warp captain identity so Lattice
 * and future titles can narrate / avatar from one source of truth.
 */
async function syncCaptainIdentityToPlayerProfile(
  uid: string,
  fields: {
    captainGender?: CaptainGender;
    captainPronouns?: CaptainPronounPreference;
    speakAs?: string | null;
    displayName?: string;
  }
): Promise<void> {
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const now = new Date().toISOString();
  const ref = doc(db, PLAYER_PROFILES, uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? (snap.data() as Record<string, unknown>) : null;

  await setDoc(
    ref,
    stripUndefinedFieldsForFirestore({
      uid,
      ...(existing?.displayName
        ? {}
        : { displayName: fields.displayName?.trim() || 'Captain' }),
      ...(existing?.visibility ? {} : { visibility: 'public' }),
      ...(existing?.createdAt ? {} : { createdAt: now }),
      ...(fields.captainGender !== undefined
        ? { captainGender: fields.captainGender }
        : {}),
      ...(fields.captainPronouns !== undefined
        ? { captainPronouns: fields.captainPronouns }
        : {}),
      ...(fields.speakAs !== undefined ? { speakAs: fields.speakAs } : {}),
      updatedAt: now,
    }),
    { merge: true }
  );
}

/** Firestore rejects explicit `undefined` in documents. */
export function stripUndefinedFieldsForFirestore<T extends Record<string, unknown>>(
  value: T
): T {
  const next: Record<string, unknown> = { ...value };
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
  return next as T;
}

export interface ReportLocalAiMatchInput {
  uid: string;
  displayName: string;
  skill: WarpSkillLevel;
  opponentOmega?: boolean;
  opponentClass1Star?: boolean;
  objective: RatedObjective;
  advisorUsed: boolean;
  /** Bridge console unlock used this match (server admin can still TEI-rate). */
  devToolsUsed?: boolean;
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
  ratingBefore: StoredRating | null;
  ratingAfter: StoredRating | null;
  muDelta: number | null;
  sigmaDelta: number | null;
  // Legacy fields for backward compatibility (deprecated)
  teiBefore?: number | null;
  teiAfter?: number | null;
  teiDelta?: number | null;
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
  ratingBefore: StoredRating | null;
  ratingAfter: StoredRating | null;
  muDelta: number | null;
  sigmaDelta: number | null;
  charterId?: string;
  charterName?: string;
  charterRatingBefore?: StoredRating | null;
  charterRatingAfter?: StoredRating | null;
  charterMuDelta?: number | null;
  charterSigmaDelta?: number | null;
  /** Module Zeta: squad id, present when this was a squad-rated match. */
  squadId?: string;
  /** When unrated, the server's reason code (e.g. `advisor_used`). */
  reason?: string;
  // Legacy fields for backward compatibility (deprecated)
  teiBefore?: number | null;
  teiAfter?: number | null;
  teiDelta?: number | null;
  charterTeiBefore?: number | null;
  charterTeiAfter?: number | null;
  charterTeiDelta?: number | null;
}

/** Raw callable response from the `reportOnlineMatch` Cloud Function. */
interface OnlineMatchCallableResult {
  rated: boolean;
  reason?: string;
  won?: boolean;
  rank?: number;
  ratingBefore?: StoredRating | null;
  ratingAfter?: StoredRating | null;
  muDelta?: number | null;
  sigmaDelta?: number | null;
  charterId?: string;
  charterRatingBefore?: StoredRating | null;
  charterRatingAfter?: StoredRating | null;
  charterMuDelta?: number | null;
  charterSigmaDelta?: number | null;
  /** Module Zeta: squad id, present when this was a squad-rated match. */
  squadId?: string;
  // Legacy fields (deprecated)
  teiBefore?: number | null;
  teiAfter?: number | null;
  teiDelta?: number | null;
  charterTeiBefore?: number | null;
  charterTeiAfter?: number | null;
  charterTeiDelta?: number | null;
  alreadyApplied?: boolean;
}

export { startingRatingForObjective as startingTeiForObjective } from './stats-schema.js';

export function incrementLocalAiSkillStats(
  current: LocalAiSkillStats,
  input: LocalAiMatchOutcome,
  options?: { startingRating?: { mu: number; sigma: number } }
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
    const prior = objectiveTeiStats(current, input.objective);
    const playerBefore: PlayerRating = prior.rating.matches > 0
      ? { mu: prior.rating.mu, sigma: prior.rating.sigma, matches: prior.rating.matches }
      : options?.startingRating
        ? { ...options.startingRating, matches: 0 }
        : DEFAULT_RATING;
    
    const track = objectiveToTrackKey(input.objective);
    const aiAnchor = getAIAnchor(track, input.skill);
    const updatedPlayer = updateVsAI('local', playerBefore, input.skill, aiAnchor, input.won);
    
    const key = objectiveToTrackKey(input.objective);
    const newDisplayGrade = getTeiDisplay(updatedPlayer, prior.rating.displayGrade).grade;
    
    next[key] = {
      rating: {
        mu: updatedPlayer.mu,
        sigma: updatedPlayer.sigma,
        matches: updatedPlayer.matches,
        displayRating: cacheDisplayRating(updatedPlayer.mu, updatedPlayer.sigma),
        displayGrade: newDisplayGrade,
      },
      wins: prior.wins + (input.won ? 1 : 0),
    };
  }

  return next;
}

export function previewLocalAiMatchReport(
  current: LocalAiSkillStats,
  input: ReportLocalAiMatchInput,
  won: boolean,
  startingRating?: { mu: number; sigma: number },
  options?: { readonly isAdmin?: boolean }
): LocalAiMatchReport {
  const teiEligible =
    !input.advisorUsed &&
    !(input.devToolsUsed === true && options?.isAdmin !== true) &&
    isRatedLocalGame(input.config);
  if (!teiEligible) {
    return {
      rated: false,
      won,
      advisorUsed: input.advisorUsed,
      objective: input.objective,
      skill: input.skill,
      ratingBefore: null,
      ratingAfter: null,
      muDelta: null,
      sigmaDelta: null,
    };
  }

  const prior = objectiveTeiStats(current, input.objective);
  const playerBefore: PlayerRating = prior.rating.matches > 0
    ? { mu: prior.rating.mu, sigma: prior.rating.sigma, matches: prior.rating.matches }
    : startingRating
      ? { ...startingRating, matches: 0 }
      : DEFAULT_RATING;
  
  const track = objectiveToTrackKey(input.objective);
  const aiAnchor = getAIAnchor(track, input.skill);
  const updatedPlayer = updateVsAI('local', playerBefore, input.skill, aiAnchor, won);
  
  const teiDisplayBefore = getTeiDisplay(playerBefore, prior.rating.displayGrade);
  const teiDisplayAfter = getTeiDisplay(updatedPlayer, teiDisplayBefore.grade);
  
  const ratingBefore: StoredRating = {
    mu: playerBefore.mu,
    sigma: playerBefore.sigma,
    matches: playerBefore.matches,
    displayRating: cacheDisplayRating(playerBefore.mu, playerBefore.sigma),
    displayGrade: teiDisplayBefore.grade,
  };
  
  const ratingAfter: StoredRating = {
    mu: updatedPlayer.mu,
    sigma: updatedPlayer.sigma,
    matches: updatedPlayer.matches,
    displayRating: cacheDisplayRating(updatedPlayer.mu, updatedPlayer.sigma),
    displayGrade: teiDisplayAfter.grade,
  };

  return {
    rated: true,
    won,
    advisorUsed: false,
    objective: input.objective,
    skill: input.skill,
    ratingBefore,
    ratingAfter,
    muDelta: updatedPlayer.mu - playerBefore.mu,
    sigmaDelta: updatedPlayer.sigma - playerBefore.sigma,
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

/** Federation profile identity fields (preferred over playerStats when set). */
export async function fetchCaptainIdentityFromProfile(uid: string): Promise<{
  captainGender?: CaptainGender;
  captainPronouns?: CaptainPronounPreference;
  speakAs?: string | null;
} | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }
  const db = getFirestoreDb();
  if (!db) {
    return null;
  }
  const snap = await getDoc(doc(db, PLAYER_PROFILES, uid));
  if (!snap.exists()) {
    return null;
  }
  const data = snap.data() as {
    captainGender?: unknown;
    captainPronouns?: unknown;
    speakAs?: unknown;
  };
  return {
    captainGender:
      data.captainGender === 'other' ||
      data.captainGender === 'male' ||
      data.captainGender === 'female'
        ? data.captainGender
        : undefined,
    captainPronouns:
      data.captainPronouns &&
      typeof data.captainPronouns === 'object' &&
      data.captainPronouns !== null &&
      'preset' in data.captainPronouns
        ? (data.captainPronouns as CaptainPronounPreference)
        : undefined,
    speakAs:
      typeof data.speakAs === 'string' || data.speakAs === null
        ? data.speakAs
        : undefined,
  };
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
  let displayName: string | undefined;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;
    displayName = existing?.displayName;

    tx.set(
      ref,
      {
        ...(existing?.displayName ? {} : { displayName: 'Captain' }),
        ...(existing ? {} : { uid }),
        captainGender,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  try {
    await syncCaptainIdentityToPlayerProfile(uid, {
      captainGender,
      displayName,
    });
  } catch (err) {
    console.warn('[stats] failed to sync captainGender to playerProfiles', err);
  }
}

export async function saveCaptainPronouns(
  uid: string,
  captainPronouns: CaptainPronounPreference
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const now = new Date().toISOString();
  let displayName: string | undefined;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;
    displayName = existing?.displayName;

    tx.set(
      ref,
      {
        ...(existing?.displayName ? {} : { displayName: 'Captain' }),
        ...(existing ? {} : { uid }),
        captainPronouns,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  try {
    await syncCaptainIdentityToPlayerProfile(uid, {
      captainPronouns,
      displayName,
    });
  } catch (err) {
    console.warn(
      '[stats] failed to sync captainPronouns to playerProfiles',
      err
    );
  }
}

export async function saveCaptainSpeakAs(
  uid: string,
  speakAs: string | null
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }

  const sanitized = sanitizeSpeakAs(speakAs);
  const now = new Date().toISOString();
  let displayName: string | undefined;
  await runTransaction(db, async (tx) => {
    const ref = doc(db, PLAYER_STATS, uid);
    const snap = await tx.get(ref);
    const existing = snap.exists()
      ? (snap.data() as PlayerStatsDocument)
      : null;
    displayName = existing?.displayName;

    tx.set(
      ref,
      {
        ...(existing?.displayName ? {} : { displayName: 'Captain' }),
        ...(existing ? {} : { uid }),
        speakAs: sanitized,
        updatedAt: now,
      },
      { merge: true }
    );
  });

  try {
    await syncCaptainIdentityToPlayerProfile(uid, {
      speakAs: sanitized,
      displayName,
    });
  } catch (err) {
    console.warn('[stats] failed to sync speakAs to playerProfiles', err);
  }
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
      ratingBefore: StoredRating | null;
      ratingAfter: StoredRating | null;
      muDelta: number | null;
    }
  >('reportPracticeAiMatch', {
    displayName: input.displayName,
    skill: input.skill,
    opponentOmega: input.opponentOmega,
    opponentClass1Star: input.opponentClass1Star,
    objective: input.objective,
    advisorUsed: input.advisorUsed,
    decisionPct: input.decisionPct,
    decisionGrade: input.decisionGrade,
    seed: input.seed,
    config: input.config,
    humanActions,
    ...(input.devToolsUsed === true ? { devToolsUsed: true } : {}),
  });

  return {
    rated: result.rated,
    won: result.won,
    advisorUsed: input.advisorUsed,
    objective: input.objective,
    skill: input.skill,
    ratingBefore: result.ratingBefore,
    ratingAfter: result.ratingAfter,
    muDelta: result.muDelta,
    sigmaDelta:
      result.ratingBefore != null && result.ratingAfter != null
        ? result.ratingAfter.sigma - result.ratingBefore.sigma
        : null,
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

/**
 * Report a completed online sector for human-pool TEI. The server re-derives the
 * standings from the authoritative game document, re-verifies every human seat,
 * and applies OpenSkill FFA rating updates (humans anchored against Ensign–Commander AI). Rating all
 * eligible captains is idempotent per `gameId`, so it is safe for any verified
 * captain at the table to call once the sector completes.
 */
export async function reportOnlineMatch(
  gameId: string,
  objective: RatedObjective
): Promise<OnlineHumanSelfReport | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const result = await callFunction<
    { gameId: string },
    OnlineMatchCallableResult
  >('reportOnlineMatch', { gameId });

  if (!result.rated) {
    return {
      rated: false,
      won: false,
      advisorUsed: result.reason === 'advisor_used',
      objective,
      humanPool: true,
      rank: 0,
      ratingBefore: null,
      ratingAfter: null,
      muDelta: null,
      sigmaDelta: null,
      reason: result.reason,
    };
  }

  return {
    rated: true,
    won: result.won ?? false,
    advisorUsed: false,
    objective,
    humanPool: true,
    rank: result.rank ?? 0,
    ratingBefore: result.ratingBefore ?? null,
    ratingAfter: result.ratingAfter ?? null,
    muDelta: result.muDelta ?? null,
    sigmaDelta: result.sigmaDelta ?? null,
    ...(result.charterId
      ? {
          charterId: result.charterId,
          charterRatingBefore: result.charterRatingBefore ?? null,
          charterRatingAfter: result.charterRatingAfter ?? null,
          charterMuDelta: result.charterMuDelta ?? null,
          charterSigmaDelta: result.charterSigmaDelta ?? null,
        }
      : {}),
    ...(result.squadId ? { squadId: result.squadId } : {}),
  };
}

export function displayPlayerObjectiveTei(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): number | null {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    const seedRating = startingRatingForObjective(stats, objective);
    if (seedRating) {
      const tei = getTeiDisplay({ ...seedRating, matches: 0 });
      return tei.score;
    }
    return null;
  }
  const trackStats = objectiveTeiStats(bucket, objective);
  if (trackStats.rating.matches > 0) {
    const tei = getTeiDisplay(
      { 
        mu: trackStats.rating.mu, 
        sigma: trackStats.rating.sigma, 
        matches: trackStats.rating.matches 
      },
      trackStats.rating.displayGrade
    );
    return tei.score;
  }
  const seedRating = startingRatingForObjective(stats, objective);
  if (seedRating) {
    const tei = getTeiDisplay({ ...seedRating, matches: 0 });
    return tei.score;
  }
  return null;
}

/**
 * Get full TEI display (grade + score) for a player's objective rating.
 * Returns the complete TEI display with grade letter and score.
 */
export function getPlayerTeiDisplay(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): { grade: TeiGrade; score: number; formatted: string } | null {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    const seedRating = startingRatingForObjective(stats, objective);
    if (seedRating) {
      return getTeiDisplay({ ...seedRating, matches: 0 });
    }
    return null;
  }
  const trackStats = objectiveTeiStats(bucket, objective);
  if (trackStats.rating.matches > 0) {
    return getTeiDisplay(
      { 
        mu: trackStats.rating.mu, 
        sigma: trackStats.rating.sigma, 
        matches: trackStats.rating.matches 
      },
      trackStats.rating.displayGrade
    );
  }
  const seedRating = startingRatingForObjective(stats, objective);
  if (seedRating) {
    return getTeiDisplay({ ...seedRating, matches: 0 });
  }
  return null;
}

/**
 * Get stored rating for a player's objective.
 * Returns the full rating object with mu, sigma, matches, displayGrade.
 */
export function getPlayerStoredRating(
  stats: PlayerStatsDocument | null,
  skill: WarpSkillLevel,
  objective: RatedObjective
): StoredRating | null {
  const bucket = stats?.localAi?.[skill];
  if (!bucket) {
    return null;
  }
  const trackStats = objectiveTeiStats(bucket, objective);
  if (trackStats.rating.matches > 0) {
    return trackStats.rating;
  }
  return null;
}

export function hasStartingTeiPlacedForObjective(
  stats: PlayerStatsDocument | null,
  objective: RatedObjective
): boolean {
  const key = objectiveToTrackKey(objective);
  return stats?.startingRating?.[key] !== undefined;
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
    if (objectiveTeiStats(bucket, objective).rating.matches > 0) {
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
  // Check if player has any human rating for this objective
  const trackKey = objectiveToTrackKey(objective);
  const humanRating = stats?.humanRating?.[trackKey]?.rating;
  return !humanRating || humanRating.matches === 0;
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
