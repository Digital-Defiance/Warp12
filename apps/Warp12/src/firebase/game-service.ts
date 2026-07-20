import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_GAME_OBJECTIVE,
  generateCoordinateSet,
  hasWarpedModules,
  sanitizeModuleConfigForObjective,
  shuffleCoordinates,
  startGame,
  warpSetProfile,
  type GameAction,
  type GameObjective,
  type GoOutOvertimePolicy,
  type GoOutStructure,
  type HouseRulesConfig,
  type GameState,
  type WarpSkillLevel,
} from 'warp12-engine';
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { FIRESTORE_COLLECTIONS, getFirestoreDb } from './config.js';
import { extractHands, mergeHandsIntoGame } from './serialize.js';
import { stripUndefined } from './strip-undefined.js';
import { sanitizeSpeakAs } from '../game/captain-speak-as.js';
import {
  isAiCaptain,
  isAiCaptainId,
  pickNextAiOfficer,
  toAiCaptainId,
} from '../game/ai-captain.js';
import {
  buildPublicDoc,
  prepareOnlineAction,
} from './online-action.js';
import {
  loadPrivateHandsForTurnOrder,
  shouldRedealHandsAfterScore,
  toHandDocument,
} from './round-end-hands.js';
import {
  isRoundAwaitingScore,
  remoteHandCaptainIdsForViewer,
  remoteHandIdsNeedingHydration,
  shouldResubscribeRemoteHands,
  type OnlineWatchMode,
} from './remote-hands.js';
import type {
  FirestoreCaptain,
  FirestoreGameDocument,
  FirestorePlayerHandDocument,
  FirestoreRoundMove,
  OnlineLobbySettings,
} from './schema.js';
import {
  clampOnlineMaxPlayers,
  ONLINE_MAX_PLAYERS,
  ONLINE_MIN_PLAYERS,
} from './schema.js';
import { allocateUniqueCallSign } from './display-name.js';
import { WARP12_OFFICIAL_RULES_PROFILE_ID } from './rules-profile.js';

export type { OnlineWatchMode } from './remote-hands.js';
export {
  isRoundAwaitingScore,
  remoteHandCaptainIdsForViewer,
  shouldResubscribeRemoteHands,
} from './remote-hands.js';

function gameRef(gameId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  return doc(db, FIRESTORE_COLLECTIONS.games, gameId);
}

function handRef(gameId: string, playerId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  return doc(db, FIRESTORE_COLLECTIONS.games, gameId, 'hands', playerId);
}

function captainIds(captains: readonly FirestoreCaptain[]): string[] {
  return captains.map((captain) => captain.id);
}

function maxPlayersFor(doc: FirestoreGameDocument): number {
  return doc.maxPlayers ?? ONLINE_MAX_PLAYERS;
}

export function generateGameCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export interface CreateLobbyOptions {
  objective?: GameObjective;
  maxPlayers?: number;
  campaignRounds?: number;
  goOutStructure?: GoOutStructure;
  goOutWinsToWin?: number;
  goOutOvertime?: GoOutOvertimePolicy;
  /** Index into fleet for the match's first-round starter (-1 = engine picks). */
  matchStarterIndex?: number;
  maxPip?: number;
  modules?: OnlineLobbySettings['modules'];
  houseRules?: HouseRulesConfig;
  /** Host intent to play for TEI (default true). */
  rated?: boolean;
  /** True when the host is signed in with a durable (non-anonymous) account. */
  verified?: boolean;
  charterId?: string;
  rulesProfileId?: string;
  /** Host spoken-as alias (snapshotted onto roster). */
  speakAs?: string | null;
  /** Match-level TTS speak-as (default true). */
  useSpeakAs?: boolean;
}

export async function createLobby(
  gameId: string,
  hostId: string,
  displayName: string,
  options: CreateLobbyOptions = {}
): Promise<string> {
  const now = new Date().toISOString();
  const hostSpeakAs = sanitizeSpeakAs(options.speakAs);
  const captains: FirestoreCaptain[] = [
    {
      id: hostId,
      displayName,
      pointsScore: 0,
      joinedAt: now,
      ...(hostSpeakAs ? { speakAs: hostSpeakAs } : {}),
      ...(options.verified !== undefined ? { verified: options.verified } : {}),
    },
  ];
  const objective = options.objective ?? DEFAULT_GAME_OBJECTIVE;
  const modules = sanitizeModuleConfigForObjective(
    options.modules ?? {},
    objective
  );
  const maxPip = options.maxPip ?? 12;
  // Warped modules (Epsilon/Kappa/Lambda) never rate — force casual.
  const rated =
    maxPip === 12 && !hasWarpedModules(modules)
      ? (options.rated ?? true)
      : false;
  const payload: FirestoreGameDocument = {
    id: gameId,
    phase: 'lobby',
    hostId,
    createdAt: now,
    updatedAt: now,
    objective,
    campaignRounds: options.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS,
    ...(options.goOutStructure ? { goOutStructure: options.goOutStructure } : {}),
    ...(options.goOutWinsToWin != null ? { goOutWinsToWin: options.goOutWinsToWin } : {}),
    ...(options.goOutOvertime ? { goOutOvertime: options.goOutOvertime } : {}),
    ...(options.matchStarterIndex != null && options.matchStarterIndex >= 0
      ? { matchStarterIndex: options.matchStarterIndex }
      : {}),
    maxPip,
    rated,
    useSpeakAs: options.useSpeakAs !== false,
    maxPlayers: clampOnlineMaxPlayers(
      options.maxPlayers ?? ONLINE_MAX_PLAYERS,
      warpSetProfile(maxPip).maxPlayers
    ),
    modules: stripUndefined({ ...modules }),
    houseRules: options.houseRules,
    ...(options.charterId
      ? {
          charterId: options.charterId,
          rulesProfileId:
            options.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID,
        }
      : {}),
    captainIds: [hostId],
    captains,
    completedRounds: 0,
    round: null,
    allowSpectate: true,
    spectatorIds: [],
  };

  await setDoc(gameRef(gameId), payload);
  return gameId;
}

export async function joinLobby(
  gameId: string,
  playerId: string,
  displayName: string,
  options: { verified?: boolean; speakAs?: string | null } = {}
): Promise<{ displayName: string }> {
  let assignedName = displayName.trim();
  const joinSpeakAs = sanitizeSpeakAs(options.speakAs);

  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.phase !== 'lobby') {
      throw new Error('Game already started');
    }
    const existing = data.captains.find((c) => c.id === playerId);
    if (existing) {
      assignedName = existing.displayName;
      return;
    }
    if (data.captains.length >= maxPlayersFor(data)) {
      throw new Error('Lobby is full');
    }

    assignedName = allocateUniqueCallSign(data.captains, displayName);
    const now = new Date().toISOString();
    const captains = [
      ...data.captains,
      {
        id: playerId,
        displayName: assignedName,
        pointsScore: 0,
        joinedAt: now,
        ...(joinSpeakAs ? { speakAs: joinSpeakAs } : {}),
        ...(options.verified !== undefined
          ? { verified: options.verified }
          : {}),
      },
    ];
    tx.update(gameRef(gameId), {
      captains,
      captainIds: captainIds(captains),
      updatedAt: now,
    });
  });

  return { displayName: assignedName };
}

export async function leaveLobby(
  gameId: string,
  playerId: string
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.phase !== 'lobby') {
      throw new Error('Mission already underway');
    }
    if (!data.captains.some((c) => c.id === playerId)) {
      return;
    }
    if (data.hostId === playerId) {
      throw new Error('Host must transfer command or dissolve the sector');
    }

    const captains = data.captains.filter((c) => c.id !== playerId);
    const now = new Date().toISOString();
    tx.update(gameRef(gameId), {
      captains,
      captainIds: captainIds(captains),
      updatedAt: now,
    });
    tx.delete(handRef(gameId, playerId));
  });
}

export interface AddAiCaptainOptions {
  displayName?: string;
  skill?: WarpSkillLevel;
  useLookahead?: boolean;
}

export async function addAiCaptain(
  gameId: string,
  hostId: string,
  options: AddAiCaptainOptions = {}
): Promise<FirestoreCaptain> {
  let created: FirestoreCaptain | null = null;

  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can add AI officers');
    }
    if (data.phase !== 'lobby') {
      throw new Error('AI officers can only be added in the waiting room');
    }
    if (data.captains.length >= maxPlayersFor(data)) {
      throw new Error('Fleet is at capacity');
    }

    const officer = pickNextAiOfficer(data.captains);
    if (!officer) {
      throw new Error('All AI officer slots are already aboard');
    }

    const displayName = allocateUniqueCallSign(
      data.captains,
      options.displayName?.trim() || officer.displayName
    );
    const now = new Date().toISOString();
    created = {
      id: toAiCaptainId(officer.id),
      displayName,
      pointsScore: 0,
      joinedAt: now,
      isAi: true,
      skill: options.skill ?? 'lieutenant',
    };

    const captains = [...data.captains, created];
    tx.update(gameRef(gameId), {
      captains,
      captainIds: captainIds(captains),
      updatedAt: now,
    });
  });

  return created!;
}

export interface UpdateAiCaptainPatch {
  displayName?: string;
  skill?: WarpSkillLevel;
  useLookahead?: boolean;
  /** Spoken-as alias for TTS; null/empty clears. */
  speakAs?: string | null;
}

export async function updateAiCaptain(
  gameId: string,
  hostId: string,
  aiCaptainId: string,
  patch: UpdateAiCaptainPatch
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can configure AI officers');
    }
    if (data.phase !== 'lobby') {
      throw new Error('AI officers are locked once the mission launches');
    }

    const index = data.captains.findIndex((captain) => captain.id === aiCaptainId);
    if (index === -1) {
      throw new Error('AI officer not found');
    }
    if (!isAiCaptain(data.captains[index]!)) {
      throw new Error('Only AI officers can be configured here');
    }

    const current = data.captains[index]!;
    const nextDisplayName =
      patch.displayName !== undefined
        ? allocateUniqueCallSign(
            data.captains.filter((captain) => captain.id !== aiCaptainId),
            patch.displayName.trim() || current.displayName
          )
        : current.displayName;

    const base: FirestoreCaptain = {
      ...current,
      displayName: nextDisplayName,
      ...(patch.skill !== undefined ? { skill: patch.skill } : {}),
      ...(patch.useLookahead !== undefined
        ? { useLookahead: patch.useLookahead }
        : {}),
    };
    let next: FirestoreCaptain = base;
    if (patch.speakAs !== undefined) {
      const alias = sanitizeSpeakAs(patch.speakAs);
      const { speakAs: _cleared, ...withoutSpeakAs } = base;
      void _cleared;
      next = alias ? { ...withoutSpeakAs, speakAs: alias } : withoutSpeakAs;
    }

    const captains = [...data.captains];
    captains[index] = next;

    tx.update(gameRef(gameId), {
      captains,
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * Lobby-only: set or clear a captain's spoken-as alias (frozen at launch).
 * Host may edit any seat; a captain may edit only their own.
 */
export async function updateCaptainSpeakAs(
  gameId: string,
  actorId: string,
  targetCaptainId: string,
  speakAs: string | null
): Promise<void> {
  const next = sanitizeSpeakAs(speakAs);
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.phase !== 'lobby') {
      throw new Error('Spoken-as is locked once the mission launches');
    }
    const isHost = data.hostId === actorId;
    if (!isHost && actorId !== targetCaptainId) {
      throw new Error('Only the host can edit another captain’s spoken-as');
    }
    if (!isHost && !data.captains.some((c) => c.id === actorId)) {
      throw new Error('Not aboard this sector');
    }

    const index = data.captains.findIndex((c) => c.id === targetCaptainId);
    if (index === -1) {
      throw new Error('Captain not found');
    }

    const captains = [...data.captains];
    const current = captains[index]!;
    captains[index] = next
      ? { ...current, speakAs: next }
      : (() => {
          const { speakAs: _removed, ...rest } = current;
          void _removed;
          return rest;
        })();

    tx.update(gameRef(gameId), {
      captains,
      updatedAt: new Date().toISOString(),
    });
  });
}

/** Lobby-only match toggle: when false, TTS uses call signs only. */
export async function setLobbyUseSpeakAs(
  gameId: string,
  hostId: string,
  useSpeakAs: boolean
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can change spoken-as settings');
    }
    if (data.phase !== 'lobby') {
      throw new Error('Spoken-as settings are locked once the mission launches');
    }
    tx.update(gameRef(gameId), {
      useSpeakAs,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function kickCaptain(
  gameId: string,
  hostId: string,
  targetId: string
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can remove a captain');
    }
    if (data.phase !== 'lobby') {
      throw new Error('Cannot remove captains during a mission');
    }
    if (targetId === hostId) {
      throw new Error('Host cannot remove themselves');
    }

    const captains = data.captains.filter((c) => c.id !== targetId);
    const now = new Date().toISOString();
    tx.update(gameRef(gameId), {
      captains,
      captainIds: captainIds(captains),
      updatedAt: now,
    });
    tx.delete(handRef(gameId, targetId));
  });
}

/** Host clears the public spectator gallery without disabling spectate. */
export async function clearSpectatorGallery(
  gameId: string,
  hostId: string
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can clear the spectator gallery');
    }
    tx.update(gameRef(gameId), {
      spectatorIds: [],
      updatedAt: new Date().toISOString(),
    });
  });
}

/**
 * After a guest links Google in the waiting room, stamp `verified` on their
 * lobby seat so rating eligibility updates before launch. Host-only (rules
 * allow host lobby writes); non-hosts rely on Auth at TEI report time.
 */
export async function markLobbyCaptainVerified(
  gameId: string,
  hostId: string,
  captainId: string
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const ref = gameRef(gameId);
    const snap = await tx.get(ref);
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.phase !== 'lobby') {
      throw new Error('Verification can only be stamped in the lobby');
    }
    if (data.hostId !== hostId) {
      throw new Error('Only the host can update lobby seat verification');
    }
    if (!data.captainIds.includes(captainId)) {
      throw new Error('Captain is not aboard this sector');
    }
    const captains = data.captains.map((captain) =>
      captain.id === captainId ? { ...captain, verified: true } : captain
    );
    tx.update(ref, {
      captains,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function updateLobbySettings(
  gameId: string,
  hostId: string,
  settings: Partial<OnlineLobbySettings>
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can change sector settings');
    }

    // Spectator gallery may be toggled mid-mission; other settings stay lobby-locked.
    const onlySpectateToggle =
      settings.allowSpectate !== undefined &&
      Object.keys(settings).every((k) => k === 'allowSpectate');
    if (data.phase !== 'lobby' && !onlySpectateToggle) {
      throw new Error('Settings are locked once the mission launches');
    }

    if (onlySpectateToggle) {
      tx.update(gameRef(gameId), {
        allowSpectate: settings.allowSpectate,
        ...(settings.allowSpectate === false ? { spectatorIds: [] } : {}),
        updatedAt: new Date().toISOString(),
      });
      return;
    }

    const factorMax = warpSetProfile(data.maxPip ?? 12).maxPlayers;
    const maxPlayers = settings.maxPlayers
      ? clampOnlineMaxPlayers(settings.maxPlayers, factorMax)
      : maxPlayersFor(data);
    if (data.captains.length > maxPlayers) {
      throw new Error('Too many captains aboard for that fleet size');
    }

    const nextMaxPip = settings.maxPip ?? data.maxPip ?? 12;
    const nextObjective = settings.objective ?? data.objective ?? 'points';
    const modulesSource = settings.modules ?? data.modules;
    const nextModules = sanitizeModuleConfigForObjective(
      modulesSource,
      nextObjective
    );
    let nextRated: boolean | undefined =
      nextMaxPip !== 12
        ? false
        : settings.rated !== undefined
          ? settings.rated
          : undefined;
    // Warped modules force casual; keep the host from leaving rated=true.
    if (hasWarpedModules(nextModules)) {
      nextRated = false;
    }

    tx.update(gameRef(gameId), {
      ...(settings.objective !== undefined
        ? { objective: settings.objective }
        : {}),
      ...(settings.campaignRounds !== undefined
        ? { campaignRounds: settings.campaignRounds }
        : {}),
      ...(settings.goOutStructure !== undefined
        ? { goOutStructure: settings.goOutStructure }
        : {}),
      ...(settings.goOutWinsToWin !== undefined
        ? { goOutWinsToWin: settings.goOutWinsToWin }
        : {}),
      ...(settings.goOutOvertime !== undefined
        ? { goOutOvertime: settings.goOutOvertime }
        : {}),
      ...(settings.matchStarterIndex !== undefined
        ? settings.matchStarterIndex >= 0
          ? { matchStarterIndex: settings.matchStarterIndex }
          : { matchStarterIndex: deleteField() }
        : {}),
      ...(settings.maxPip !== undefined ? { maxPip: settings.maxPip } : {}),
      ...(nextRated !== undefined ? { rated: nextRated } : {}),
      ...(settings.modules !== undefined || nextModules !== modulesSource
        ? { modules: stripUndefined(nextModules) }
        : {}),
      ...(settings.houseRules !== undefined
        ? { houseRules: settings.houseRules }
        : {}),
      ...(settings.charterId !== undefined
        ? settings.charterId
          ? {
              charterId: settings.charterId,
              rulesProfileId:
                settings.rulesProfileId ?? WARP12_OFFICIAL_RULES_PROFILE_ID,
            }
          : {
              charterId: deleteField(),
              rulesProfileId: deleteField(),
            }
        : {}),
      ...(settings.rulesProfileId !== undefined && settings.charterId
        ? { rulesProfileId: settings.rulesProfileId }
        : {}),
      ...(settings.allowSpectate !== undefined
        ? {
            allowSpectate: settings.allowSpectate,
            ...(settings.allowSpectate === false ? { spectatorIds: [] } : {}),
          }
        : {}),
      ...(settings.useSpeakAs !== undefined
        ? { useSpeakAs: settings.useSpeakAs }
        : {}),
      maxPlayers,
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function launchOnlineGame(
  gameId: string,
  hostId: string
): Promise<void> {
  const db = getFirestoreDb()!;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const lobby = snap.data() as FirestoreGameDocument;
    if (lobby.hostId !== hostId) {
      throw new Error('Only the host can launch');
    }
    if (lobby.phase !== 'lobby') {
      throw new Error('Game already started');
    }
    if (lobby.captains.length < ONLINE_MIN_PLAYERS) {
      throw new Error(`Need at least ${ONLINE_MIN_PLAYERS} captains`);
    }

    const maxPip = lobby.maxPip ?? 12;
    const shuffled = shuffleCoordinates(generateCoordinateSet(maxPip));

    const captainList = lobby.captains.map((c) => ({
      id: c.id,
      displayName: c.displayName,
    }));
    const matchStarterIndex = lobby.matchStarterIndex;
    const roundStarterId =
      matchStarterIndex != null &&
      matchStarterIndex >= 0 &&
      matchStarterIndex < captainList.length
        ? captainList[matchStarterIndex]?.id
        : hostId;

    const game = startGame(
      {
        id: gameId,
        captains: captainList,
        modules: lobby.modules ?? {},
        houseRules: lobby.houseRules,
        objective: lobby.objective ?? 'points',
        campaignRounds: lobby.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS,
        ...(lobby.goOutStructure ? { goOutStructure: lobby.goOutStructure } : {}),
        ...(lobby.goOutWinsToWin != null ? { goOutWinsToWin: lobby.goOutWinsToWin } : {}),
        ...(lobby.goOutOvertime ? { goOutOvertime: lobby.goOutOvertime } : {}),
        ...(matchStarterIndex != null && matchStarterIndex >= 0
          ? { matchStarterIndex }
          : {}),
        maxPip,
      },
      { shuffledCoordinates: shuffled, roundStarterId: roundStarterId ?? hostId }
    );

    const publicDoc = buildPublicDoc(game, {
      hostId: lobby.hostId,
      createdAt: lobby.createdAt,
      captains: lobby.captains,
      rated: lobby.rated,
      maxPlayers: maxPlayersFor(lobby),
      useSpeakAs: lobby.useSpeakAs !== false,
      allowSpectate: lobby.allowSpectate,
      spectatorIds: lobby.spectatorIds ?? [],
      charterId: lobby.charterId,
      rulesProfileId: lobby.rulesProfileId,
    });

    // Deal private hands while the sector is still in lobby — rules allow the host
    // to write every hand only before launch flips phase to active.
    for (const [playerId, hand] of Object.entries(extractHands(game))) {
      const handDoc: FirestorePlayerHandDocument = {
        captainId: playerId,
        coordinates: hand.map((c) => ({ low: c.low, high: c.high })),
        updatedAt: new Date().toISOString(),
      };
      tx.set(handRef(gameId, playerId), handDoc);
    }

    tx.set(gameRef(gameId), publicDoc);
  });
}

/** Host returns a finished or stalled sector to the waiting room for a rematch. */
export async function resetSectorToLobby(
  gameId: string,
  hostId: string
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      throw new Error('Game not found');
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can reset the sector');
    }

    const resetCaptains = data.captains.map((c) => ({
      ...c,
      pointsScore: 0,
      goOutWins: 0,
    }));

    const now = new Date().toISOString();
    tx.update(gameRef(gameId), {
      phase: 'lobby',
      round: null,
      captains: resetCaptains,
      captainIds: captainIds(resetCaptains),
      completedRounds: 0,
      flash: null,
      goOutOvertimePending: deleteField(),
      goOutInOvertime: deleteField(),
      updatedAt: now,
    });

    for (const captain of resetCaptains) {
      tx.delete(handRef(gameId, captain.id));
    }
  });
}

/** Host dissolves the sector for everyone (waiting room or mid-mission). */
export async function dissolveLobby(
  gameId: string,
  hostId: string
): Promise<void> {
  await runTransaction(getFirestoreDb()!, async (tx) => {
    const snap = await tx.get(gameRef(gameId));
    if (!snap.exists()) {
      return;
    }
    const data = snap.data() as FirestoreGameDocument;
    if (data.hostId !== hostId) {
      throw new Error('Only the host can dissolve the sector');
    }
    for (const captain of data.captains) {
      tx.delete(handRef(gameId, captain.id));
    }
    tx.delete(gameRef(gameId));
  });
}

export function subscribeLobby(
  gameId: string,
  onData: (doc: FirestoreGameDocument | null) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db) {
    onError(new Error('Firebase is not configured'));
    return () => undefined;
  }

  return onSnapshot(
    gameRef(gameId),
    (snap) => {
      onData(snap.exists() ? (snap.data() as FirestoreGameDocument) : null);
    },
    (err) => onError(err)
  );
}

export interface OnlineGameSnapshot {
  state: GameState | null;
  handCounts: Record<string, number>;
  /** Shared per-round applied-action history (full log + advisor source). */
  moveLog: readonly FirestoreRoundMove[];
  connected: boolean;
  /**
   * True when the game/hand snapshots reflect server-confirmed data. False when
   * we are showing local-cache-only data that the backend has not yet confirmed
   * (Firestore `metadata.fromCache`) — i.e. this client is out of sync.
   */
  synced: boolean;
  hostId: string;
  sectorCaptains: FirestoreCaptain[];
  aiHands: Record<string, readonly { low: number; high: number }[]>;
  /** Host intent to play for TEI (default true). */
  rated: boolean;
  /** When false, TTS uses call signs only (default true). */
  useSpeakAs: boolean;
  dissolved: boolean;
  /** Viewer was removed from captainIds (ops kick). */
  ejected: boolean;
  /** Ops soft-terminated the sector. */
  terminated: boolean;
  /** Host pause — temporary spectator mode for everyone. */
  paused: boolean;
  pauseReason?: string;
  allowSpectate: boolean;
  spectatorCount: number;
  /** Viewer is listed in spectatorIds. */
  isSpectator: boolean;
}

export function subscribeOnlineGame(
  gameId: string,
  viewerId: string,
  onSnapshotState: (snapshot: OnlineGameSnapshot) => void,
  onError: (error: Error) => void,
  mode: OnlineWatchMode = 'play'
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db) {
    onError(new Error('Firebase is not configured'));
    return () => undefined;
  }

  let latestDoc: FirestoreGameDocument | null = null;
  let ownHand: FirestorePlayerHandDocument | null = null;
  let remoteHandsByCaptain: Record<
    string,
    readonly { low: number; high: number }[]
  > = {};
  let gameConnected = false;
  let handConnected = mode !== 'play';
  let gameFromCache = true;
  let handFromCache = mode !== 'play' ? false : true;
  let serverConfirmedMissing = false;
  let remoteHandUnsubs: Unsubscribe[] = [];

  const isSynced = () =>
    gameConnected && handConnected && !gameFromCache && !handFromCache;

  const hydrateMissingRemoteHands = () => {
    if (!latestDoc?.round) {
      return;
    }
    const ids = remoteHandIdsNeedingHydration(
      latestDoc.round.handCounts,
      remoteHandsByCaptain,
      remoteHandCaptainIdsForViewer(latestDoc, viewerId, mode)
    );
    if (ids.length === 0) {
      return;
    }
    void Promise.all(
      ids.map(async (captainId) => {
        try {
          const snap = await getDoc(handRef(gameId, captainId));
          remoteHandsByCaptain[captainId] = snap.exists()
            ? (snap.data() as FirestorePlayerHandDocument).coordinates
            : [];
        } catch {
          // Listener / rules may still catch up; leave empty for pending UI.
        }
      })
    ).then(() => {
      publish();
    });
  };

  const resubscribeRemoteHands = () => {
    for (const unsub of remoteHandUnsubs) {
      unsub();
    }
    remoteHandUnsubs = [];
    // Keep prior mirrors for seats we still need — round-end resubscribe used
    // to wipe AI/human hands to {} and briefly score everyone as +0.
    const previousHands = remoteHandsByCaptain;
    remoteHandsByCaptain = {};

    const ids = remoteHandCaptainIdsForViewer(latestDoc, viewerId, mode);
    for (const captainId of ids) {
      if (previousHands[captainId]) {
        remoteHandsByCaptain[captainId] = previousHands[captainId];
      }
    }
    if (ids.length === 0) {
      publish();
      return;
    }

    for (const captainId of ids) {
      remoteHandUnsubs.push(
        onSnapshot(
          handRef(gameId, captainId),
          (snap) => {
            remoteHandsByCaptain[captainId] = snap.exists()
              ? (snap.data() as FirestorePlayerHandDocument).coordinates
              : [];
            publish();
          },
          (err) => {
            // One seat's listen failure must not block others. Fall back to get
            // so host AI proxy / round-end scoring still see real tiles (the
            // runner already used getDoc successfully when listeners were empty).
            console.warn('[online] remote hand subscription failed', {
              gameId,
              captainId,
              message: err.message,
            });
            void getDoc(handRef(gameId, captainId))
              .then((snap) => {
                remoteHandsByCaptain[captainId] = snap.exists()
                  ? (snap.data() as FirestorePlayerHandDocument).coordinates
                  : [];
                publish();
              })
              .catch(() => {
                /* leave empty; hydrate may retry on the next public-doc update */
              });
          }
        )
      );
    }
    hydrateMissingRemoteHands();
  };

  const publish = () => {
    const spectatorIds = latestDoc?.spectatorIds ?? [];
    const meta = {
      allowSpectate: latestDoc?.allowSpectate !== false,
      spectatorCount: spectatorIds.length,
      isSpectator: spectatorIds.includes(viewerId),
      paused: latestDoc?.paused === true,
      useSpeakAs: latestDoc?.useSpeakAs !== false,
      ...(latestDoc?.pauseReason
        ? { pauseReason: latestDoc.pauseReason }
        : {}),
    };

    if (!latestDoc) {
      // Hand snapshots can arrive before the public game doc on subscribe; that is
      // not a host dissolve. Likewise, Firestore can emit a cache-only exists=false
      // snapshot during launch before the server update lands — wait for confirmation.
      if (!gameConnected || !serverConfirmedMissing) {
        return;
      }
      onSnapshotState({
        state: null,
        handCounts: {},
        moveLog: [],
        connected: gameConnected && handConnected,
        synced: isSynced(),
        hostId: '',
        sectorCaptains: [],
        aiHands: {},
        rated: true,
        useSpeakAs: true,
        dissolved: true,
        ejected: false,
        terminated: false,
        paused: false,
        allowSpectate: true,
        spectatorCount: 0,
        isSpectator: false,
      });
      return;
    }

    if (latestDoc.opsTerminated === true) {
      onSnapshotState({
        state: null,
        handCounts: {},
        moveLog: [],
        connected: gameConnected && handConnected,
        synced: isSynced(),
        hostId: latestDoc.hostId,
        sectorCaptains: latestDoc.captains,
        aiHands: {},
        rated: false,
        dissolved: false,
        ejected: false,
        terminated: true,
        ...meta,
      });
      return;
    }

    const isCaptain = latestDoc.captainIds.includes(viewerId);
    if (mode === 'play' && !isCaptain) {
      onSnapshotState({
        state: null,
        handCounts: {},
        moveLog: [],
        connected: gameConnected && handConnected,
        synced: isSynced(),
        hostId: latestDoc.hostId,
        sectorCaptains: latestDoc.captains,
        aiHands: {},
        rated: latestDoc.rated ?? true,
        dissolved: false,
        ejected: true,
        terminated: false,
        ...meta,
      });
      return;
    }

    if (mode === 'spectate') {
      if (latestDoc.allowSpectate === false && !meta.isSpectator) {
        onSnapshotState({
          state: null,
          handCounts: {},
          moveLog: [],
          connected: gameConnected && handConnected,
          synced: isSynced(),
          hostId: latestDoc.hostId,
          sectorCaptains: latestDoc.captains,
          aiHands: {},
          rated: latestDoc.rated ?? true,
          dissolved: false,
          ejected: true,
          terminated: false,
          ...meta,
        });
        return;
      }
      if (isCaptain) {
        // Seated captains should use /play, not /watch.
        onSnapshotState({
          state: null,
          handCounts: {},
          moveLog: [],
          connected: gameConnected && handConnected,
          synced: isSynced(),
          hostId: latestDoc.hostId,
          sectorCaptains: latestDoc.captains,
          aiHands: {},
          rated: latestDoc.rated ?? true,
          dissolved: false,
          ejected: false,
          terminated: false,
          ...meta,
        });
        return;
      }
    }

    const hands: Record<string, readonly { low: number; high: number }[]> =
      {};
    if (latestDoc.round) {
      for (const captainId of latestDoc.round.turnOrder) {
        if (mode === 'play' && captainId === viewerId && ownHand) {
          hands[captainId] = ownHand.coordinates;
        } else if (Object.prototype.hasOwnProperty.call(remoteHandsByCaptain, captainId)) {
          hands[captainId] = remoteHandsByCaptain[captainId]!;
        } else {
          hands[captainId] = [];
        }
      }
    }

    const aiHands = Object.fromEntries(
      Object.entries(remoteHandsByCaptain).filter(([captainId]) =>
        isAiCaptainId(captainId)
      )
    );

    onSnapshotState({
      state: mergeHandsIntoGame(latestDoc, hands),
      handCounts: latestDoc.round?.handCounts ?? {},
      moveLog: latestDoc.round?.moveLog ?? [],
      connected: gameConnected && handConnected,
      synced: isSynced(),
      hostId: latestDoc.hostId,
      sectorCaptains: latestDoc.captains,
      aiHands,
      rated: latestDoc.rated ?? true,
      dissolved: false,
      ejected: false,
      terminated: false,
      ...meta,
    });
  };

  const unsubGame = onSnapshot(
    gameRef(gameId),
    { includeMetadataChanges: true },
    (snap) => {
      gameConnected = true;
      gameFromCache = snap.metadata.fromCache;
      if (!snap.exists()) {
        // Local cache can briefly report "missing" while the public doc updates.
        // Keep the last live snapshot until the server confirms the new doc.
        if (snap.metadata.fromCache) {
          return;
        }
        serverConfirmedMissing = true;
        latestDoc = null;
        publish();
        return;
      }

      serverConfirmedMissing = false;
      const nextDoc = snap.data() as FirestoreGameDocument;
      const resubscribe = shouldResubscribeRemoteHands(
        latestDoc,
        nextDoc,
        viewerId,
        mode
      );
      latestDoc = nextDoc;
      if (resubscribe) {
        resubscribeRemoteHands();
      } else {
        // Host AI seats: public handCounts move every turn, but a dead/empty
        // listener leaves aiHands {} until round-end. Hydrate whenever mirrors
        // lag the public counts (same getDoc path the AI runner already uses).
        hydrateMissingRemoteHands();
      }
      publish();
    },
    (err) => {
      gameConnected = false;
      onError(err);
    }
  );

  const unsubHand =
    mode === 'play'
      ? onSnapshot(
          handRef(gameId, viewerId),
          { includeMetadataChanges: true },
          (snap) => {
            handConnected = true;
            handFromCache = snap.metadata.fromCache;
            ownHand = snap.exists()
              ? (snap.data() as FirestorePlayerHandDocument)
              : null;
            publish();
          },
          (err) => {
            handConnected = false;
            onError(err);
          }
        )
      : () => undefined;

  resubscribeRemoteHands();

  return () => {
    unsubGame();
    unsubHand();
    for (const unsub of remoteHandUnsubs) {
      unsub();
    }
  };
}

export async function submitOnlineAction(
  gameId: string,
  actorId: string,
  action: GameAction
): Promise<{ ok: true } | { ok: false; violation: string }> {
  const db = getFirestoreDb()!;

  return runTransaction(db, async (tx) => {
    const gameSnap = await tx.get(gameRef(gameId));
    if (!gameSnap.exists()) {
      return { ok: false as const, violation: 'GAME_NOT_ACTIVE' };
    }

    const docData = gameSnap.data() as FirestoreGameDocument;
    const playerId =
      action.type === 'END_ROUND'
        ? action.winnerId ?? ''
        : action.type === 'CATCH_DROP_TO_IMPULSE'
          ? action.challengerId
          : action.type === 'SALAMANDER_PENALTY'
            ? action.holderId
            : action.type === 'LONGEST_TRAIL_BONUS' ||
                action.type === 'TEMPORAL_DEBT_PENALTY'
              ? action.playerId
              : action.playerId;

    const isEndRound = action.type === 'END_ROUND';
    const hands: Record<string, readonly { low: number; high: number }[]> = {};

    if (docData.round) {
      if (isEndRound) {
        Object.assign(
          hands,
          await loadPrivateHandsForTurnOrder(
            tx,
            gameId,
            docData.round.turnOrder,
            handRef
          )
        );
      } else {
        const handSnap = await tx.get(handRef(gameId, playerId));
        const handDoc = handSnap.exists()
          ? (handSnap.data() as FirestorePlayerHandDocument)
          : null;
        for (const captainId of docData.round.turnOrder) {
          hands[captainId] =
            captainId === playerId && handDoc ? handDoc.coordinates : [];
        }
      }
    }

    const planned = prepareOnlineAction(docData, actorId, action, hands);
    if (!planned.ok) {
      return { ok: false as const, violation: planned.violation };
    }

    const publicDoc = planned.publicDoc;
    const result = { ok: true as const, state: planned.nextState };

    if (isEndRound) {
      if (shouldRedealHandsAfterScore(result.state.phase)) {
        for (const [id, coordinates] of Object.entries(
          extractHands(result.state)
        )) {
          tx.set(handRef(gameId, id), toHandDocument(id, coordinates));
        }
      } else {
        for (const captainId of docData.captainIds) {
          tx.delete(handRef(gameId, captainId));
        }
      }
      tx.set(gameRef(gameId), publicDoc);
    } else {
      tx.set(gameRef(gameId), publicDoc);
      const actorHand = result.state.round?.hands[playerId] ?? [];
      tx.set(
        handRef(gameId, playerId),
        toHandDocument(playerId, actorHand)
      );
    }

    return { ok: true as const };
  });
}

export interface HostDebugFirestoreSnapshot {
  game: FirestoreGameDocument | null;
  hands: Record<string, FirestorePlayerHandDocument | null>;
  handReadErrors: Record<string, string>;
  fullGameState: GameState | null;
}

export async function fetchHostDebugSnapshot(
  gameId: string,
  captainIds: readonly string[]
): Promise<HostDebugFirestoreSnapshot> {
  const gameSnap = await getDoc(gameRef(gameId));
  const game = gameSnap.exists()
    ? (gameSnap.data() as FirestoreGameDocument)
    : null;
  const hands: Record<string, FirestorePlayerHandDocument | null> = {};
  const handReadErrors: Record<string, string> = {};

  await Promise.all(
    captainIds.map(async (captainId) => {
      try {
        const handSnap = await getDoc(handRef(gameId, captainId));
        hands[captainId] = handSnap.exists()
          ? (handSnap.data() as FirestorePlayerHandDocument)
          : null;
      } catch (err) {
        handReadErrors[captainId] =
          err instanceof Error ? err.message : 'Could not read hand';
      }
    })
  );

  const handsByPlayer = Object.fromEntries(
    captainIds.map((captainId) => [
      captainId,
      hands[captainId]?.coordinates ?? [],
    ])
  );
  const fullGameState = game ? mergeHandsIntoGame(game, handsByPlayer) : null;

  return { game, hands, handReadErrors, fullGameState };
}

export function lobbyDocumentToState(doc: FirestoreGameDocument): GameState {
  return mergeHandsIntoGame(doc, {});
}
