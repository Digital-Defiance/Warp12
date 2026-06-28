import {
  applyAction,
  generateCoordinateSet,
  shuffleCoordinates,
  startGame,
  type GameAction,
  type GameObjective,
  type GameState,
  type WarpSkillLevel,
} from '@warp12/Warp12-lib';
import {
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  setDoc,
  type Unsubscribe,
} from 'firebase/firestore';

import { FIRESTORE_COLLECTIONS, getFirestoreDb } from './config.js';
import {
  extractHands,
  mergeHandsIntoGame,
  serializePublicGame,
} from './serialize.js';
import {
  isAiCaptain,
  isAiCaptainId,
  pickNextAiOfficer,
  toAiCaptainId,
} from '../game/ai-captain.js';
import { assertActorMaySubmit } from './ai-proxy.js';
import { allocateUniqueCallSign } from './display-name.js';
import { patchHandCounts } from './hand-counts.js';
import {
  loadPrivateHandsForTurnOrder,
  shouldRedealHandsAfterScore,
  toHandDocument,
} from './round-end-hands.js';
import type {
  FirestoreCaptain,
  FirestoreGameDocument,
  FirestorePlayerHandDocument,
  OnlineLobbySettings,
} from './schema.js';
import {
  clampOnlineMaxPlayers,
  ONLINE_MAX_PLAYERS,
  ONLINE_MIN_PLAYERS,
} from './schema.js';
import { stripUndefined } from './strip-undefined.js';

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

function mergeCaptainMetadata(
  nextCaptains: GameState['captains'],
  previous: readonly FirestoreCaptain[]
): FirestoreCaptain[] {
  const now = new Date().toISOString();
  return nextCaptains.map((captain) => {
    const prior = previous.find((entry) => entry.id === captain.id);
    const merged: FirestoreCaptain = {
      id: captain.id,
      displayName: captain.displayName,
      penaltyScore: captain.penaltyScore,
      joinedAt: prior?.joinedAt ?? now,
    };
    if (prior && isAiCaptain(prior)) {
      merged.isAi = true;
      if (prior.skill !== undefined) {
        merged.skill = prior.skill;
      }
      if (prior.useLookahead !== undefined) {
        merged.useLookahead = prior.useLookahead;
      }
    }
    return merged;
  });
}

function buildPublicDoc(
  state: GameState,
  meta: Pick<FirestoreGameDocument, 'hostId' | 'createdAt' | 'captains'> & {
    maxPlayers?: number;
  }
): FirestoreGameDocument {
  const serialized = serializePublicGame(state);
  const captains = mergeCaptainMetadata(state.captains, meta.captains);
  return stripUndefined({
    ...serialized,
    hostId: meta.hostId,
    createdAt: meta.createdAt,
    updatedAt: new Date().toISOString(),
    captainIds: captainIds(captains),
    captains,
    maxPlayers: meta.maxPlayers ?? serialized.maxPlayers ?? ONLINE_MAX_PLAYERS,
  });
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
  modules?: OnlineLobbySettings['modules'];
}

export async function createLobby(
  gameId: string,
  hostId: string,
  displayName: string,
  options: CreateLobbyOptions = {}
): Promise<string> {
  const now = new Date().toISOString();
  const captains: FirestoreCaptain[] = [
    {
      id: hostId,
      displayName,
      penaltyScore: 0,
      joinedAt: now,
    },
  ];
  const payload: FirestoreGameDocument = {
    id: gameId,
    phase: 'lobby',
    hostId,
    createdAt: now,
    updatedAt: now,
    objective: options.objective ?? 'go-out',
    maxPlayers: clampOnlineMaxPlayers(options.maxPlayers ?? ONLINE_MAX_PLAYERS),
    modules: {
      qContinuum: options.modules?.qContinuum ?? false,
      salamanderPenalty: options.modules?.salamanderPenalty ?? true,
      subspaceFracture: options.modules?.subspaceFracture ?? false,
    },
    captainIds: [hostId],
    captains,
    completedRounds: 0,
    round: null,
  };

  await setDoc(gameRef(gameId), payload);
  return gameId;
}

export async function joinLobby(
  gameId: string,
  playerId: string,
  displayName: string
): Promise<{ displayName: string }> {
  let assignedName = displayName.trim();

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
      { id: playerId, displayName: assignedName, penaltyScore: 0, joinedAt: now },
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
      penaltyScore: 0,
      joinedAt: now,
      isAi: true,
      skill: options.skill ?? 'intermediate',
      useLookahead: options.useLookahead ?? false,
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

    const captains = [...data.captains];
    captains[index] = {
      ...current,
      displayName: nextDisplayName,
      ...(patch.skill !== undefined ? { skill: patch.skill } : {}),
      ...(patch.useLookahead !== undefined
        ? { useLookahead: patch.useLookahead }
        : {}),
    };

    tx.update(gameRef(gameId), {
      captains,
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
    if (data.phase !== 'lobby') {
      throw new Error('Settings are locked once the mission launches');
    }

    const maxPlayers = settings.maxPlayers
      ? clampOnlineMaxPlayers(settings.maxPlayers)
      : maxPlayersFor(data);
    if (data.captains.length > maxPlayers) {
      throw new Error('Too many captains aboard for that fleet size');
    }

    tx.update(gameRef(gameId), {
      ...(settings.objective !== undefined
        ? { objective: settings.objective }
        : {}),
      ...(settings.modules !== undefined ? { modules: settings.modules } : {}),
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

    const shuffled = shuffleCoordinates(generateCoordinateSet(12));

    const game = startGame(
      {
        id: gameId,
        captains: lobby.captains.map((c) => ({
          id: c.id,
          displayName: c.displayName,
        })),
        modules: {
          qContinuum: lobby.modules.qContinuum,
          salamanderPenalty: lobby.modules.salamanderPenalty,
          subspaceFracture: lobby.modules.subspaceFracture,
        },
        objective: lobby.objective ?? 'penalty',
      },
      { shuffledCoordinates: shuffled, roundStarterId: hostId }
    );

    const publicDoc = buildPublicDoc(game, {
      hostId: lobby.hostId,
      createdAt: lobby.createdAt,
      captains: lobby.captains,
      maxPlayers: maxPlayersFor(lobby),
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

    const resetCaptains =
      data.objective === 'go-out'
        ? data.captains.map((c) => ({ ...c, penaltyScore: 0 }))
        : data.captains;

    const now = new Date().toISOString();
    tx.update(gameRef(gameId), {
      phase: 'lobby',
      round: null,
      captains: resetCaptains,
      captainIds: captainIds(resetCaptains),
      completedRounds: 0,
      qFlash: null,
      updatedAt: now,
    });

    for (const captain of resetCaptains) {
      tx.delete(handRef(gameId, captain.id));
    }
  });
}

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
    if (data.phase !== 'lobby') {
      throw new Error('Sector can only be dissolved from the waiting room');
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
  state: GameState;
  handCounts: Record<string, number>;
  connected: boolean;
  hostId: string;
  sectorCaptains: FirestoreCaptain[];
  aiHands: Record<string, readonly { low: number; high: number }[]>;
}

/** Captain hand subdocs the host mirrors for live state and debug export. */
function remoteHandCaptainIdsForHost(
  doc: FirestoreGameDocument | null,
  viewerId: string
): string[] {
  if (!doc || doc.hostId !== viewerId) {
    return [];
  }
  return doc.captainIds.filter((captainId) => captainId !== viewerId);
}

export function subscribeOnlineGame(
  gameId: string,
  viewerId: string,
  onSnapshotState: (snapshot: OnlineGameSnapshot) => void,
  onError: (error: Error) => void
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
  let handConnected = false;
  let remoteHandUnsubs: Unsubscribe[] = [];

  const resubscribeRemoteHands = () => {
    for (const unsub of remoteHandUnsubs) {
      unsub();
    }
    remoteHandUnsubs = [];
    remoteHandsByCaptain = {};

    const ids = remoteHandCaptainIdsForHost(latestDoc, viewerId);
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
          (err) => onError(err)
        )
      );
    }
  };

  const publish = () => {
    if (!latestDoc) {
      return;
    }

    const hands: Record<string, readonly { low: number; high: number }[]> =
      {};
    if (latestDoc.round) {
      for (const captainId of latestDoc.round.turnOrder) {
        if (captainId === viewerId && ownHand) {
          hands[captainId] = ownHand.coordinates;
        } else if (remoteHandsByCaptain[captainId]) {
          hands[captainId] = remoteHandsByCaptain[captainId];
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
      connected: gameConnected && handConnected,
      hostId: latestDoc.hostId,
      sectorCaptains: latestDoc.captains,
      aiHands,
    });
  };

  const unsubGame = onSnapshot(
    gameRef(gameId),
    (snap) => {
      gameConnected = true;
      const nextDoc = snap.exists()
        ? (snap.data() as FirestoreGameDocument)
        : null;
      const remoteIdsChanged =
        remoteHandCaptainIdsForHost(latestDoc, viewerId).join('|') !==
        remoteHandCaptainIdsForHost(nextDoc, viewerId).join('|');
      latestDoc = nextDoc;
      if (remoteIdsChanged) {
        resubscribeRemoteHands();
      }
      publish();
    },
    (err) => {
      gameConnected = false;
      onError(err);
    }
  );

  const unsubHand = onSnapshot(
    handRef(gameId, viewerId),
    (snap) => {
      handConnected = true;
      ownHand = snap.exists()
        ? (snap.data() as FirestorePlayerHandDocument)
        : null;
      publish();
    },
    (err) => {
      handConnected = false;
      onError(err);
    }
  );

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
    const authViolation = assertActorMaySubmit(docData, actorId, action);
    if (authViolation) {
      return { ok: false as const, violation: authViolation };
    }

    const playerId =
      action.type === 'END_ROUND' ? action.winnerId : action.playerId;

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
        // Only the actor's tiles are loaded; never write empty hands for opponents.
        for (const captainId of docData.round.turnOrder) {
          hands[captainId] =
            captainId === playerId && handDoc ? handDoc.coordinates : [];
        }
      }
    }

    const state = mergeHandsIntoGame(docData, hands);
    const result = applyAction(state, action);

    if (!result.ok) {
      return { ok: false as const, violation: result.violation };
    }

    const publicDoc = buildPublicDoc(result.state, {
      hostId: docData.hostId,
      createdAt: docData.createdAt,
      captains: docData.captains,
      maxPlayers: maxPlayersFor(docData),
    });

    if (publicDoc.round && docData.round && !isEndRound) {
      publicDoc.round = {
        ...publicDoc.round,
        handCounts: patchHandCounts(
          docData.round.handCounts,
          docData.round.turnOrder,
          playerId,
          result.state.round?.hands[playerId]?.length ?? 0
        ),
      };
    }

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
