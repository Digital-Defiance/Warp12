export type RatedObjective = 'go-out' | 'points';

export type WarpRole = 'admin' | 'match_official';

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
  /** Points total or tiles remaining — lower is better on both tracks. */
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
  /** Per-uid TEI applied after approval. */
  teiClaims?: Record<string, boolean>;
  /** Friend-group / charter ladder this match counts toward. */
  charterId?: string;
  rulesProfileId?: string;
  playerCount?: number;
  /** Issued on approval — downloadable match certificate (Phase 4). */
  certificate?: RatedMatchCertificate;
}

export interface RatedMatchCertificatePlayer {
  uid: string;
  displayName: string;
  rank: number;
  score: number;
  crewTeiBefore?: number;
  crewTeiAfter?: number;
  crewTeiDelta?: number;
  globalTeiBefore?: number;
  globalTeiAfter?: number;
  globalTeiDelta?: number;
  humanTeiBefore?: number;
  humanTeiAfter?: number;
  humanTeiDelta?: number;
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
}

export function normalizeMatchCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/^MT-?/, 'MT-');
}

export function generateMatchCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i += 1) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `MT-${suffix}`;
}

export function objectiveTeiKey(objective: RatedObjective): 'goOut' | 'points' {
  return objective === 'go-out' ? 'goOut' : 'points';
}

export interface ObjectiveTeiStats {
  unassistedMatches: number;
  unassistedWins: number;
  unassistedTei?: number;
}

export interface HumanTeiStats {
  goOut?: ObjectiveTeiStats;
  points?: ObjectiveTeiStats;
  seasonKey?: string;
}

export interface PlayerStatsDocument {
  uid: string;
  displayName: string;
  matchesCompleted: number;
  matchesWon: number;
  roundsPlayed: number;
  roundsWon: number;
  totalPoints: number;
  startingTei?: Partial<Record<'goOut' | 'points', number>>;
  humanTei?: HumanTeiStats;
  humanRatedGameIds?: string[];
  /** Scoped TEI per crew charter (`charterId` → track buckets). */
  groupTei?: Record<string, HumanTeiStats>;
  /** Idempotency keys `${charterId}:${matchCode|gameId}`. */
  groupRatedIds?: string[];
  updatedAt: string;
}

export function emptyObjectiveTeiStats(): ObjectiveTeiStats {
  return { unassistedMatches: 0, unassistedWins: 0 };
}

export function humanObjectiveTeiStats(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): ObjectiveTeiStats {
  const key = objectiveTeiKey(objective);
  return { ...emptyObjectiveTeiStats(), ...doc?.humanTei?.[key] };
}

export function startingTeiForObjective(
  doc: PlayerStatsDocument | null | undefined,
  objective: RatedObjective
): number | undefined {
  const key = objectiveTeiKey(objective);
  return doc?.startingTei?.[key];
}
