import {
  applyAction,
  type GameAction,
  type GameState,
} from 'warp12-engine';
import type { Coordinate } from 'warp12-engine';

import { buildAutoAllStopLogEntry, buildGameLogEntry } from 'warp12-react';

import { assertActorMaySubmit } from './ai-proxy.js';
import { patchHandCounts } from './hand-counts.js';
import { mergeHandsIntoGame, serializePublicGame } from './serialize.js';
import type {
  FirestoreCaptain,
  FirestoreGameDocument,
  FirestoreRoundMove,
} from './schema.js';
import { ONLINE_MAX_PLAYERS } from './schema.js';
import { stripUndefined } from './strip-undefined.js';
import { isAiCaptain } from '../game/ai-captain.js';

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
      pointsScore: captain.pointsScore,
      joinedAt: prior?.joinedAt ?? now,
      ...(captain.squadronId ? { squadronId: captain.squadronId } : {}),
    };
    if (prior && isAiCaptain(prior)) {
      merged.isAi = true;
      if (prior.skill !== undefined) {
        merged.skill = prior.skill;
      }
      if (prior.useLookahead !== undefined) {
        merged.useLookahead = prior.useLookahead;
      }
    } else if (prior?.verified !== undefined) {
      merged.verified = prior.verified;
    }
    return merged;
  });
}

export function buildPublicDoc(
  state: GameState,
  meta: Pick<FirestoreGameDocument, 'hostId' | 'createdAt' | 'captains' | 'rated'> & {
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
    rated: meta.rated ?? true,
    maxPlayers: meta.maxPlayers ?? serialized.maxPlayers ?? ONLINE_MAX_PLAYERS,
  });
}

export function actingPlayerIdForOnlineAction(action: GameAction): string {
  if (action.type === 'END_ROUND') {
    return action.winnerId ?? '';
  }
  if (action.type === 'CATCH_DROP_TO_IMPULSE') {
    return action.challengerId;
  }
  return action.playerId;
}

export type OnlineActionPlan =
  | { ok: false; violation: string }
  | {
      ok: true;
      playerId: string;
      nextState: GameState;
      publicDoc: FirestoreGameDocument;
    };

/** Pure online move pipeline (Firestore transaction body without I/O). */
export function prepareOnlineAction(
  docData: FirestoreGameDocument,
  actorId: string,
  action: GameAction,
  handsByPlayer: Readonly<Record<string, readonly Coordinate[]>>
): OnlineActionPlan {
  const authViolation = assertActorMaySubmit(docData, actorId, action);
  if (authViolation) {
    return { ok: false, violation: authViolation };
  }

  const playerId = actingPlayerIdForOnlineAction(action);
  const isEndRound = action.type === 'END_ROUND';
  const state = mergeHandsIntoGame(docData, handsByPlayer);
  const result = applyAction(state, action);

  if (!result.ok) {
    return { ok: false, violation: result.violation };
  }

  const publicDoc = buildPublicDoc(result.state, {
    hostId: docData.hostId,
    createdAt: docData.createdAt,
    captains: docData.captains,
    rated: docData.rated,
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

  // Shared per-round move log: carry the prior round's history forward and
  // append this action so every client renders the full log (all captains) and
  // the end-of-round advisor has the complete action history. Reset on END_ROUND
  // (the next round starts fresh); END_ROUND itself is not a ticker line.
  if (publicDoc.round) {
    const priorLog = isEndRound ? [] : docData.round?.moveLog ?? [];
    const nextLog = isEndRound
      ? []
      : appendMoveLogEntry(priorLog, {
          state,
          nextState: result.state,
          action,
          actorId: playerId,
          source: captainSource(docData.captains, playerId),
        });
    publicDoc.round = { ...publicDoc.round, moveLog: nextLog };
  }

  return { ok: true, playerId, nextState: result.state, publicDoc };
}

function captainSource(
  captains: readonly FirestoreCaptain[],
  actorId: string
): 'human' | 'ai' {
  const captain = captains.find((entry) => entry.id === actorId);
  return captain && isAiCaptain(captain) ? 'ai' : 'human';
}

function appendMoveLogEntry(
  priorLog: readonly FirestoreRoundMove[],
  input: {
    state: GameState;
    nextState: GameState;
    action: GameAction;
    actorId: string;
    source: 'human' | 'ai';
  }
): FirestoreRoundMove[] {
  const entry = buildGameLogEntry(input.state, input.nextState, input.action);
  const autoAllStop = buildAutoAllStopLogEntry(
    input.state,
    input.nextState,
    input.action
  );
  const move: FirestoreRoundMove = stripUndefined({
    at: new Date().toISOString(),
    actorId: input.actorId,
    source: input.source,
    action: input.action,
    entry: entry ?? null,
    ...(autoAllStop ? { autoAllStop } : {}),
  });
  return [...priorLog, move];
}
