/**
 * Subspace Messaging — Firestore model for online sector comms.
 *
 * Messages persist at `games/{gameId}/messages/{id}`. During a live rated
 * sector, only quick-phrase hails are allowed (enforced in Firestore rules AND
 * client-side). Casual / lobby / post-game sectors allow free-form text + DMs.
 */

import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from 'firebase/firestore';

import { getFirestoreDb } from './config.js';

export type MessageKind = 'phrase' | 'text';

/** Persisted shape (Firestore document). */
export interface SubspaceMessage {
  readonly id: string;
  readonly from: string;
  readonly fromName: string;
  readonly kind: MessageKind;
  /** Quick-phrase stable id (when kind === 'phrase'). */
  readonly phraseId?: string;
  /** Free-form text (when kind === 'text', or optional flavor on phrase). */
  readonly text?: string;
  /** DM recipient uid; absent = public all-chat. */
  readonly to?: string;
  /** Module Zeta: 'squad' = visible only to squadronId members; absent/'table' = whole sector. */
  readonly channel?: 'table' | 'squad';
  /** Module Zeta: squad id the message is scoped to (present when channel === 'squad'). */
  readonly squadronId?: string;
  readonly at: string;
}

const MESSAGE_LIMIT = 200;

function messagesCol(gameId: string) {
  const db = getFirestoreDb();
  if (!db) {
    throw new Error('Firebase is not configured');
  }
  return collection(db, 'games', gameId, 'messages');
}

/** Subscribe to the sector message stream (newest last). */
export function subscribeMessages(
  gameId: string,
  onMessages: (messages: SubspaceMessage[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const db = getFirestoreDb();
  if (!db) {
    return () => undefined;
  }

  const q = query(
    messagesCol(gameId),
    orderBy('at', 'asc'),
    limit(MESSAGE_LIMIT)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: SubspaceMessage[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<SubspaceMessage, 'id'>),
      }));
      onMessages(messages);
    },
    (err) => onError?.(err)
  );
}

/** Send a quick-phrase hail (always allowed — even during rated play). */
export async function sendQuickPhrase(
  gameId: string,
  fromUid: string,
  fromName: string,
  phraseId: string
): Promise<void> {
  await addDoc(messagesCol(gameId), {
    from: fromUid,
    fromName,
    kind: 'phrase' as MessageKind,
    phraseId,
    at: new Date().toISOString(),
  });
}

/**
 * Send a free-form text message (blocked by rules during rated active play on
 * the table channel; the squad channel is always allowed — see comms-mode.ts).
 */
export async function sendTextMessage(
  gameId: string,
  fromUid: string,
  fromName: string,
  text: string,
  to?: string,
  squad?: { channel: 'squad'; squadronId: string }
): Promise<void> {
  const payload: Record<string, unknown> = {
    from: fromUid,
    fromName,
    kind: 'text' as MessageKind,
    text: text.trim(),
    at: new Date().toISOString(),
  };
  if (to) {
    payload.to = to;
  }
  if (squad) {
    payload.channel = squad.channel;
    payload.squadronId = squad.squadronId;
  }
  await addDoc(messagesCol(gameId), payload);
}

export type { Unsubscribe };
