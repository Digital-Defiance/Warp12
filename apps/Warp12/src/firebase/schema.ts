import type { GameObjective, WarpSkillLevel } from 'warp12-engine';
import type { HouseRulesConfig } from 'warp12-engine';

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
  penaltyScore: number;
  joinedAt: string;
  isAi?: boolean;
  skill?: WarpSkillLevel;
  useLookahead?: boolean;
}

export interface OnlineLobbySettings {
  objective: GameObjective;
  maxPlayers: number;
  campaignRounds: number;
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
  dropToImpulseRequired: boolean;
  dropToImpulseDeclared: boolean;
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
  impulseEcho: boolean;
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
