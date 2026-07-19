import type { GameObjective, GoOutOvertimePolicy, GoOutStructure, WarpSkillLevel } from 'warp12-engine';
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
  modules: import('warp12-engine').GameModuleConfig;
  /**
   * Module Zeta: squad rosters for this sector, present only when the
   * squadrons module is enabled. Mirrors `GameState.squadrons` so the rating
   * Cloud Function can rank squads without replaying the match.
   */
  squadrons?: FirestoreSquadron[];
  houseRules?: HouseRulesConfig;
  /** Sector scoring objective. */
  objective: GameObjective;
  /** Penalty campaign length (or go-out fixed-rounds descent length). */
  campaignRounds: number;
  /** Go-out sector structure. Absent = sudden-death (legacy default). */
  goOutStructure?: GoOutStructure;
  /** Go-out first-to: wins required to clinch the sector. */
  goOutWinsToWin?: number;
  /** Go-out fixed-rounds: overtime policy when win-counts tie. */
  goOutOvertime?: GoOutOvertimePolicy;
  /**
   * Index into turnOrder for the match's first-round starter.
   * Absent = host seat (legacy default).
   */
  matchStarterIndex?: number;
  /**
   * True when a fixed-rounds go-out sector ended tied and the host must
   * accept or decline overtime.
   */
  goOutOvertimePending?: boolean;
  /** True while playing go-out overtime rounds (Spacedock may wrap). */
  goOutInOvertime?: boolean;
  /** Double-N max pip (9 / 12 / 15 / 18). Defaults to 12 for legacy docs. */
  maxPip?: number;
  /**
   * Host intent to play for TEI. Default `true`. When `false`, the sector is a
   * casual game — never rated — and free-form chat/DMs stay open during play.
   */
  rated?: boolean;
  /** Ops soft-terminated this sector (no further play / rematch). */
  opsTerminated?: boolean;
  opsTerminatedAt?: string;
  opsTerminatedBy?: string;
  opsTerminationReason?: string;
  /**
   * When false, public spectate is closed (host or ops). Default true when
   * omitted (legacy sectors).
   */
  allowSpectate?: boolean;
  /** Uids watching without a fleet seat. Not used for TEI / hands / moves. */
  spectatorIds?: string[];
  /**
   * Host pause — all captains become spectator-like until resumed.
   * Orthogonal to `phase` so engine state stays intact.
   */
  paused?: boolean;
  pausedAt?: string;
  pausedBy?: string;
  /** Optional note (e.g. missing captain display name). */
  pauseReason?: string;
  /** Fleet capacity (3–8). */
  maxPlayers: number;
  /** Denormalized uid list for security rules. */
  captainIds: string[];
  /** Optional crew charter for rated group TEI. */
  charterId?: string;
  /** Frozen rules profile when playing under a charter. */
  rulesProfileId?: string;
  captains: FirestoreCaptain[];
  completedRounds: number;
  /** Module Theta (Go-out) Trail Momentum claim. */
  trailMomentumClaimedBy?: string | null;
  /** Module Kappa (Go-out) Hand Exchange resolved this sector. */
  handExchangeResolved?: boolean;
  round: FirestorePublicRound | null;
  flash?: {
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
  /** Go-out campaigns: rounds won by this captain. */
  goOutWins?: number;
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
  /** Module Zeta: squadron this captain belongs to, when squadrons are enabled. */
  squadronId?: string;
}

/** Module Zeta: a squad roster, mirrored from `GameState.squadrons`. */
export interface FirestoreSquadron {
  id: string;
  memberIds: string[];
  /**
   * Canonical shared-trail key (Model C). Fallbacks to `memberIds[0]` when
   * missing on legacy docs.
   */
  trailKey?: string;
  /** Host-chosen display name, if set. */
  name?: string;
}

/** Module Epsilon: pack-and-pass draft snapshot on the public round. */
export interface FirestoreDraftState {
  currentDrafter: string;
  draftOrder: string[];
  pickNumber: number;
  currentPacks: Record<string, FirestoreCoordinate[]>;
  pickedTiles: Record<string, FirestoreCoordinate[]>;
}

export interface OnlineLobbySettings {
  objective: GameObjective;
  maxPlayers: number;
  campaignRounds: number;
  goOutStructure?: GoOutStructure;
  goOutWinsToWin?: number;
  goOutOvertime?: GoOutOvertimePolicy;
  /** Index into fleet for the match's first-round starter (-1 = engine picks). */
  matchStarterIndex?: number;
  /** Double-N max pip (9 / 12 / 15 / 18). */
  maxPip?: number;
  /** Host intent to play for TEI (default true). */
  rated?: boolean;
  /** Allow public spectate (default true). */
  allowSpectate?: boolean;
  modules: import('warp12-engine').GameModuleConfig;
  houseRules?: HouseRulesConfig;
  charterId?: string;
  rulesProfileId?: string;
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
  continuumPendingInvoker?: string | null;
  continuumEffects?: FirestoreQRoundEffects | null;
  continuumWagerPending?: {
    playerId: string;
    options: [FirestoreCoordinate, FirestoreCoordinate];
  } | null;
  /** Module Kappa (Go-out) Hand Exchange pending give-back. */
  handExchangePending?: {
    largerPlayerId: string;
    smallerPlayerId: string;
    takenCoordinate: FirestoreCoordinate;
  } | null;
  roundStarterOpening?: {
    playerId: string;
  } | null;
  /** True once the deluxe opening double-chart is finished for this round. */
  roundStarterOpeningResolved?: boolean;
  dropToImpulseCallPending?: string | null;
  dropToImpulseCatchable?: string | null;
  playedThisTurn?: boolean;
  drewThisTurn?: boolean;
  shieldChangedThisTurn?: boolean;
  /** Transient return-to-warp signal (drives the cue/log on other clients). */
  returnedToWarp?: boolean;
  /** Module Lambda: transient wormhole-opened cue. */
  wormholeOpened?: boolean;
  /** Module Delta: transient spool-abort retrieve cue (unfinished double to hand). */
  spoolAbortRetrieve?: boolean;
  /** Module Gamma: face-up sensor market. */
  sensorGrid?: FirestoreCoordinate[];
  /** Module Epsilon: pack-and-pass draft (null / omitted outside drafting). */
  draftState?: FirestoreDraftState | null;
  /** Module Delta: captain holding the Hazard Marker. */
  hazardMarkerHolder?: string | null;
  /** Module Delta: passes while holding the marker (resets on transfer). */
  hazardMarkerPassCount?: number;
  /** Module Eta: debt tokens per captain. */
  debtTokens?: Record<string, number>;
  /**
   * Module Zeta: round-scoped squads (includes trailKey). Prefer this over the
   * top-level game `squadrons` when rehydrating an active round.
   */
  squadrons?: FirestoreSquadron[];
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
  coachRequestedAt?: string;
  coachRoundNumber?: number;
  coachUsedThisRound?: boolean;
  /** Seat heartbeat — ISO time of last client ping (online connectivity). */
  lastSeenAt?: string;
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
  /** Module Eta (Go-out) Desperation Dig forced-open remaining turn-ends. */
  distressBeaconForcedOpenRemaining?: number;
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
/** Absolute online fleet ceiling (Warp 18). Hosts still clamp via lobby maxPlayers. */
export const ONLINE_MAX_PLAYERS = 18;

export function clampOnlineMaxPlayers(
  maxPlayers: number,
  factorMaxPlayers: number = ONLINE_MAX_PLAYERS
): number {
  const ceiling = Math.min(ONLINE_MAX_PLAYERS, Math.max(ONLINE_MIN_PLAYERS + 1, factorMaxPlayers));
  return Math.min(ceiling, Math.max(ONLINE_MIN_PLAYERS + 1, maxPlayers));
}
