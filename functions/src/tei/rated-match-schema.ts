import type {
  ObjectiveRatingStats,
  RatedObjective,
  RatingTrackKey,
  StoredRating,
} from './rating-types.js';
import {
  emptyObjectiveRatingStats,
  objectiveToTrackKey,
  toStoredRating,
  toStoredRatingWithGrade,
} from './rating-types.js';

export type { RatedObjective, StoredRating, ObjectiveRatingStats };
export { objectiveToTrackKey, toStoredRating, toStoredRatingWithGrade };

export type WarpRole = 'admin' | 'moderator' | 'match_official';

export type RatedMatchStatus =
  | 'draft'
  | 'open'
  | 'completed'
  | 'approved'
  | 'rejected';

export interface RatedMatchParticipant {
  uid: string;
  displayName: string;
  checkedInAt: string;
}

export interface RatedMatchStanding {
  uid: string;
  displayName: string;
  rank: number;
  score: number;
}

export interface RatedMatchDocument {
  matchCode: string;
  status: RatedMatchStatus;
  objective: RatedObjective;
  campaignRounds: number;
  venue?: string;
  notes?: string;
  officialId: string;
  officialDisplayName: string;
  createdAt: string;
  updatedAt: string;
  openedAt?: string;
  completedAt?: string;
  approvedAt?: string;
  approvedBy?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  participants: RatedMatchParticipant[];
  standings: RatedMatchStanding[];
  teiClaims?: Record<string, boolean>;
  charterId?: string;
  rulesProfileId?: string;
  playerCount?: number;
  certificate?: RatedMatchCertificate;
}

export interface RatedMatchCertificatePlayer {
  uid: string;
  displayName: string;
  rank: number;
  score: number;
  // Crew rating (if charter match) - OpenSkill format
  crewRatingBefore?: StoredRating;
  crewRatingAfter?: StoredRating;
  crewMuDelta?: number;
  // Human pool rating (if non-charter match) - OpenSkill format
  humanRatingBefore?: StoredRating;
  humanRatingAfter?: StoredRating;
  humanMuDelta?: number;
}

export interface RatedMatchCertificate {
  version: 1;
  matchCode: string;
  issuedAt: string;
  objective: RatedObjective;
  charter?: {
    charterId: string;
    name: string;
    slug: string;
    rulesProfileId: string;
    playerCount: number;
    campaignRounds: number;
    seasonLabel?: string;
  };
  players: RatedMatchCertificatePlayer[];
  /** HMAC-SHA256 hex over canonical certificate payload (required). */
  signature?: string;
  /** Cloud Storage object path for the required PDF (e.g. certificates/MT-….pdf). */
  pdfPath?: string;
  /** Public verify hint. */
  verifyUrl?: string;
}

export function normalizeMatchCode(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.startsWith('MT-')) {
    return trimmed;
  }
  if (trimmed.startsWith('MT')) {
    return `MT-${trimmed.slice(2)}`;
  }
  return `MT-${trimmed}`;
}

export function generateMatchCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `MT-${suffix}`;
}

export function objectiveTeiKey(objective: RatedObjective): RatingTrackKey {
  return objectiveToTrackKey(objective);
}

export interface HumanRatingStats {
  goOut?: ObjectiveRatingStats;
  points?: ObjectiveRatingStats;
  seasonKey?: string;
}

/** Module Zeta: squad (team) rating stats, split by objective like humanRating. */
export interface SquadRatingStats {
  goOut?: ObjectiveRatingStats;
  points?: ObjectiveRatingStats;
}

export interface PlayerStatsDocument {
  uid: string;
  displayName: string;
  matchesCompleted: number;
  matchesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  totalPoints: number;
  /** Optional self-reported starting rating before first rated game per objective. */
  startingRating?: Partial<
    Record<RatingTrackKey, { mu: number; sigma: number }>
  >;
  /** Human-opponent pool rating (online rated sectors, humans only). */
  humanRating?: HumanRatingStats;
  humanRatedGameIds?: string[];
  /** Crew-specific ratings (charter matches). */
  groupRating?: Record<string, HumanRatingStats>;
  groupRatedIds?: string[];
  /**
   * Module Zeta: squad-play rating (online rated squad sectors). Kept separate
   * from `humanRating` — squad and FFA performance are different skills.
   * Only written once `SQUADRONS_RATING_CALIBRATED` is true (see anchors.ts).
   */
  squadRating?: SquadRatingStats;
  squadRatedGameIds?: string[];
  updatedAt: string;
}

export function squadObjectiveRatingStats(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): ObjectiveRatingStats {
  const key = objectiveToTrackKey(objective);
  const existing = doc?.squadRating?.[key];
  return existing ?? emptyObjectiveRatingStats();
}

export function humanObjectiveRatingStats(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): ObjectiveRatingStats {
  const key = objectiveToTrackKey(objective);
  const existing = doc?.humanRating?.[key];
  return existing ?? emptyObjectiveRatingStats();
}

export function startingRatingForObjective(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): { mu: number; sigma: number } | undefined {
  const key = objectiveToTrackKey(objective);
  return doc?.startingRating?.[key];
}
