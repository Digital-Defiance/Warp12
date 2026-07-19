import { beforeAll, describe, expect, it } from 'vitest';

import {
  callCallable,
  createEmulatorUser,
  ensureEmulatorAdmin,
  expectCallableError,
} from './emulator-harness.js';
import { seedActiveGame } from './seed-active-game.js';

function gameCode(prefix: string): string {
  return `${prefix}${Date.now().toString(36).toUpperCase().slice(-5)}`;
}

describe('spectate callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('joinSpectate / leaveSpectate for a non-seat observer', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const watcher = await createEmulatorUser({ displayName: 'Watcher' });
    const gameId = gameCode('SPC');

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
      allowSpectate: true,
    });

    const joined = await callCallable<{ ok: true; spectating: boolean }>(
      'joinSpectate',
      { gameId },
      watcher.idToken
    );
    expect(joined.ok).toBe(true);
    expect(joined.spectating).toBe(true);

    let snap = await db.collection('games').doc(gameId).get();
    expect(snap.data()?.spectatorIds).toContain(watcher.uid);

    const left = await callCallable<{ ok: true; spectating: boolean }>(
      'leaveSpectate',
      { gameId },
      watcher.idToken
    );
    expect(left.spectating).toBe(false);

    snap = await db.collection('games').doc(gameId).get();
    expect(snap.data()?.spectatorIds ?? []).not.toContain(watcher.uid);
  });

  it('rejects joinSpectate when the caller is already seated', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = gameCode('SEAT');

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    await expectCallableError(
      () => callCallable('joinSpectate', { gameId }, guest.idToken),
      'FAILED_PRECONDITION'
    );
  });

  it('setAllowSpectate clears the gallery when disabled by host', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const watcher = await createEmulatorUser({ displayName: 'Watcher' });
    const gameId = gameCode('OFF');

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'lobby',
      spectatorIds: [watcher.uid],
    });

    const result = await callCallable<{ ok: true; allowSpectate: boolean }>(
      'setAllowSpectate',
      { gameId, allow: false },
      host.idToken
    );
    expect(result.allowSpectate).toBe(false);

    const snap = await db.collection('games').doc(gameId).get();
    expect(snap.data()?.allowSpectate).toBe(false);
    expect(snap.data()?.spectatorIds).toEqual([]);
  });

  it('opsDropSpectators requires moderator', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const watcher = await createEmulatorUser({ displayName: 'Watcher' });
    const mod = await createEmulatorUser({
      displayName: 'Mod',
      roles: ['moderator'],
    });
    const gameId = gameCode('ODS');

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      spectatorIds: [watcher.uid],
    });

    await expectCallableError(
      () => callCallable('opsDropSpectators', { gameId }, host.idToken),
      'PERMISSION_DENIED'
    );

    const result = await callCallable<{ ok: true; dropped: number }>(
      'opsDropSpectators',
      { gameId },
      mod.idToken
    );
    expect(result.dropped).toBe(1);

    const snap = await db.collection('games').doc(gameId).get();
    expect(snap.data()?.spectatorIds).toEqual([]);
  });
});
