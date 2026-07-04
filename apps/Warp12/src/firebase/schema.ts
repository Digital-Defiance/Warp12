import type { GameObjective, WarpSkillLevel } from 'warp12-engine';
import type { GameAction, HouseRulesConfig } from 'warp12-engine';
import type { GameLogEntry } from 'warp12-react';

/**
 * One applied action in an online round, persisted on the shared game doc so
 * every client can render the full move log (all captains, not just the local
 * player) and the end-of-round advisor has the complete action history.
 */
export interface FirestoreRoundMove {
  at: string;
  actorId: string;
  source: 'human' | 'ai';
  action: GameAction;
  /** Precomputed ticker entry (null for actions that produce no log line). */
  entry: GameLogEntry | null;
  /** Auto "All Stop!" ceremony entry emitted alongside a round-winning chart. */
  autoAllStop?: GameLogEntry | null;
}

export interface FirestoreGameDocument {
  id: string;
  phase: import('warp12-engine').GamePhase;
  hostId: string;
  createdAt: string;
  updatedAt: string;
  modules: {
    qContinuum: boolean;
    salamanderPenalty: boolean;
    subspaceFracture: boolean;
    subspaceFractureScope: import('warp12-engine').SubspaceFractureScope;
  };
  houseRules?: HouseRulesConfig;
  /** Sector scoring objective. */
  objective: GameObjective;
  /** Penalty campaign length (1–13). */
  campaignRounds: number;
  /**
   * Host intent to play for TEI. Default `true`. When `false`, the sector is a
   * casual game — never rated — and free-form chat/DMs stay open during play.
   */
  rated?: boolean;
  /** Fleet capacity (3–8). */
  maxPlayers: number;
  /** Denormalized uid list for security rules. */
  captainIds: string[];
  captains: FirestoreCaptain[];
  completedRounds: number;
  round: FirestorePublicRound | null;
  qFlash?: {
    invokedBy: string;
    effect: {
      kind: string;
      targetPlayerId?: string;
      peek?: { index: number; coordinate: FirestoreCoordinate };
    };
  } | null;
}

export interface FirestoreCaptain {
  id: string;
  displayName: string;
  pointsScore: number;
  joinedAt: string;
  isAi?: boolean;
  skill?: WarpSkillLevel;
  useLookahead?: boolean;
  /**
   * Human captains only: `true` when signed in with a durable (non-anonymous)
   * account. Drives the lobby "unrated" warning; the server re-verifies against
   * Firebase Auth before applying any TEI.
   */
  verified?: boolean;
}

export interface OnlineLobbySettings {
  objective: GameObjective;
  maxPlayers: number;
  campaignRounds: number;
  /** Host intent to play for TEI (default true). */
  rated?: boolean;
  modules: {
    qContinuum: boolean;
    salamanderPenalty: boolean;
    subspaceFracture: boolean;
    subspaceFractureScope: import('warp12-engine').SubspaceFractureScope;
  };
  houseRules?: HouseRulesConfig;
}

export interface FirestorePublicRound {
  roundNumber: number;
  spacedockValue: number;
  phase: import('warp12-engine').RoundPhase;
  activePlayerId: string;
  turnOrder: string[];
  handCounts: Record<string, number>;
  unchartedSectors: FirestoreCoordinate[];
  allStopRequired: boolean;
  allStopDeclared: boolean;
  roundWinnerId: string | null;
  roundBlocked?: boolean;
  mandatoryPlay?: {
    playerId: string;
    coordinate: FirestoreCoordinate;
  } | null;
  pendingRoundWin?: {
    playerId: string;
    routeKind: string;
  } | null;
  qPendingInvoker?: string | null;
  qEffects?: FirestoreQRoundEffects | null;
  qGamblePending?: {
    playerId: string;
    options: [FirestoreCoordinate, FirestoreCoordinate];
  } | null;
  roundStarterOpening?: {
    playerId: string;
  } | null;
  dropToImpulseCallPending?: string | null;
  dropToImpulseCatchable?: string | null;
  playedThisTurn?: boolean;
  drewThisTurn?: boolean;
  shieldChangedThisTurn?: boolean;
  /** Transient return-to-warp signal (drives the cue/log on other clients). */
  returnedToWarp?: boolean;
  /** Applied-action history for this round (shared log + advisor source). */
  moveLog?: FirestoreRoundMove[];
  table: FirestoreTableDocument;
}

export interface FirestoreQRoundEffects {
  reverseTurnOrder: boolean;
  temporalInversion: boolean;
  openAllTrails: boolean;
  suppressNextFracture: boolean;
  skipNextTurnFor: string[];
  peekedSector: {
    index: number;
    coordinate: FirestoreCoordinate;
    visibleTo: string;
  } | null;
  salamanderSwap: boolean;
  allStopEcho: boolean;
}

export interface FirestorePlayerHandDocument {
  captainId: string;
  coordinates: FirestoreCoordinate[];
  updatedAt: string;
}

/** Visible to all sector captains when someone consults the tactical advisor. */
export interface FirestoreCoachPresence {
  coachRequestedAt: string;
  coachRoundNumber: number;
  coachUsedThisRound: boolean;
}

export interface FirestoreActionDocument {
  sequence: number;
  type: string;
  playerId: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface FirestoreTrailDocument {
  playerId: string;
  tiles: FirestorePlacedCoordinate[];
  distressBeaconActive: boolean;
  /** Manual shield control: owner has serviced their own trail since opening. */
  distressBeaconChartedOwnTrailSinceDown?: boolean;
}

export interface FirestoreNeutralZoneDocument {
  tiles: FirestorePlacedCoordinate[];
}

export interface FirestoreCoordinate {
  low: number;
  high: number;
}

export interface FirestorePlacedCoordinate {
  coordinate: FirestoreCoordinate;
  index: number;
  openValue: number;
}

export interface FirestoreSubspaceFractureDocument {
  active: boolean;
  anchor: FirestorePlacedCoordinate;
  stabilizers: FirestorePlacedCoordinate[];
  requiredValue: number;
  neutralZone?: boolean;
  trailCaptainId?: string;
}

export interface FirestoreRedAlertDocument {
  active: boolean;
  anchor: FirestorePlacedCoordinate;
  responsiblePlayerId: string | null;
  trailPlayerId: string;
  neutralZone?: boolean;
  passed?: boolean;
}

export interface FirestoreTableDocument {
  spacedock: { value: number; placedBy: string };
  warpTrails: FirestoreTrailDocument[];
  neutralZone: FirestoreNeutralZoneDocument;
  subspaceFracture: FirestoreSubspaceFractureDocument | null;
  redAlert: FirestoreRedAlertDocument | null;
}

export function gameCollectionPath(): string {
  return 'games';
}

export function handCollectionPath(gameId: string): string {
  return `games/${gameId}/hands`;
}

export const ONLINE_MIN_PLAYERS = 2;
export const ONLINE_MAX_PLAYERS = 8;

export function clampOnlineMaxPlayers(maxPlayers: number): number {
  return Math.min(ONLINE_MAX_PLAYERS, Math.max(ONLINE_MIN_PLAYERS + 1, maxPlayers));
}
