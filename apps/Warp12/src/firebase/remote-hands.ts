import type { FirestoreGameDocument } from './schema.js';

export type OnlineWatchMode = 'play' | 'spectate' | 'supervise';

export function isRoundAwaitingScore(
  doc: FirestoreGameDocument | null | undefined
): boolean {
  return (
    doc?.phase === 'active' &&
    doc.round != null &&
    doc.round.phase === 'ended'
  );
}

/** Captain hand subdocs mirrored for live AI proxy / round-end public scoring. */
export function remoteHandCaptainIdsForViewer(
  doc: FirestoreGameDocument | null,
  viewerId: string,
  mode: OnlineWatchMode
): string[] {
  if (mode !== 'play' || !doc?.round) {
    return [];
  }
  // Host always mirrors every seat (AI proxy + debug export).
  if (doc.hostId === viewerId) {
    return doc.captainIds.filter((captainId) => captainId !== viewerId);
  }
  // During round-end revelation every member may read all hands (Firestore rules);
  // subscribe so Salamander / pip tallies are public on every client.
  if (isRoundAwaitingScore(doc) && doc.captainIds.includes(viewerId)) {
    return doc.captainIds.filter((captainId) => captainId !== viewerId);
  }
  return [];
}

/**
 * Whether to tear down and recreate remote-hand listeners after a public-doc
 * update.
 *
 * Host seat lists usually do not change when a round ends, but mid-round
 * listeners can fail or stay empty (AI runner then falls back to one-shot
 * gets). Force a resubscribe when revelation opens so round-end scoring sees
 * real hands. Mid-round lag is also healed by getDoc hydration whenever public
 * handCounts disagree with mirrors.
 */
export function shouldResubscribeRemoteHands(
  previous: FirestoreGameDocument | null,
  next: FirestoreGameDocument,
  viewerId: string,
  mode: OnlineWatchMode
): boolean {
  const prevIds = remoteHandCaptainIdsForViewer(
    previous,
    viewerId,
    mode
  ).join('|');
  const nextIds = remoteHandCaptainIdsForViewer(next, viewerId, mode).join('|');
  if (prevIds !== nextIds) {
    return true;
  }
  return !isRoundAwaitingScore(previous) && isRoundAwaitingScore(next);
}

/** Seats whose public handCounts say they hold tiles but we have no mirror yet. */
export function remoteHandIdsNeedingHydration(
  handCounts: Readonly<Record<string, number>> | undefined,
  mirrored: Readonly<Record<string, readonly unknown[]>>,
  captainIds: readonly string[]
): string[] {
  const counts = handCounts ?? {};
  return captainIds.filter((captainId) => {
    const expected = counts[captainId] ?? 0;
    if (expected <= 0) {
      return false;
    }
    return (mirrored[captainId]?.length ?? 0) === 0;
  });
}
