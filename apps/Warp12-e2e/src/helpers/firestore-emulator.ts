import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

interface EmulatorGameDocument {
  phase: string;
  hostId: string;
  captainIds: string[];
  captains: { id: string; displayName: string }[];
  round: {
    phase: string;
    roundNumber: number;
    activePlayerId: string;
    unchartedSectors: unknown[];
  } | null;
}

let db: Firestore | null = null;

function emulatorFirestore(): Firestore {
  if (!db) {
    process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
    if (getApps().length === 0) {
      initializeApp({ projectId: 'demo-warp12' });
    }
    db = getFirestore();
  }
  return db;
}

export async function readGameDocument(
  sectorCode: string
): Promise<EmulatorGameDocument | null> {
  const snap = await emulatorFirestore().doc(`games/${sectorCode}`).get();
  return (snap.data() as EmulatorGameDocument | undefined) ?? null;
}

export async function readPrivateHand(
  sectorCode: string,
  playerId: string
): Promise<readonly { low: number; high: number }[] | null> {
  const snap = await emulatorFirestore()
    .doc(`games/${sectorCode}/hands/${playerId}`)
    .get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() as { coordinates?: { low: number; high: number }[] };
  return data.coordinates ?? null;
}

export async function readMessages(
  sectorCode: string
): Promise<readonly { phraseId?: string; text?: string; fromName?: string }[]> {
  const snap = await emulatorFirestore()
    .collection(`games/${sectorCode}/messages`)
    .orderBy('at', 'asc')
    .get();
  return snap.docs.map((doc) => doc.data() as { phraseId?: string; text?: string; fromName?: string });
}

export function captainName(
  doc: EmulatorGameDocument,
  captainId: string
): string {
  return doc.captains.find((captain) => captain.id === captainId)?.displayName ?? captainId;
}
