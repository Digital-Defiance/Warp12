import { beforeAll, describe, expect, it } from 'vitest';

import {
  CallableError,
  callCallable,
  createEmulatorUser,
  ensureEmulatorAdmin,
  expectCallableError,
} from './emulator-harness.js';
import { seedActiveGame } from './seed-active-game.js';

describe('countActiveSectors (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('returns a public activity pulse without auth', async () => {
    const db = ensureEmulatorAdmin();
    const gameId = `ACT${Date.now().toString(36).toUpperCase().slice(-6)}`;
    await seedActiveGame(db, {
      gameId,
      hostId: 'host-pulse',
      captains: [
        { id: 'host-pulse', displayName: 'Host' },
        { id: 'guest-pulse', displayName: 'Guest' },
      ],
      phase: 'lobby',
    });

    const result = await callCallable<{
      ok: true;
      active: number;
      latticeActive?: number;
      scanned: number;
    }>('countActiveSectors', {});

    expect(result.ok).toBe(true);
    expect(result.active).toBeGreaterThanOrEqual(1);
    expect(result.scanned).toBeGreaterThanOrEqual(1);
    expect(typeof (result.latticeActive ?? 0)).toBe('number');
  });
});

describe('host continuity callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('hostTransferHost moves command to another human', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `XFR${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'lobby',
    });

    const result = await callCallable<{
      ok: true;
      newHostId: string;
    }>(
      'hostTransferHost',
      { gameId, newHostId: guest.uid },
      host.idToken
    );

    expect(result.ok).toBe(true);
    expect(result.newHostId).toBe(guest.uid);

    const snap = await db.collection('games').doc(gameId).get();
    expect(snap.data()?.hostId).toBe(guest.uid);
  });

  it('rejects hostTransferHost from a non-host', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `NXF${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'lobby',
    });

    await expectCallableError(
      () =>
        callCallable(
          'hostTransferHost',
          { gameId, newHostId: host.uid },
          guest.idToken
        ),
      'PERMISSION_DENIED'
    );
  });

  it('hostReplaceCaptainWithAi remaps a guest seat mid-mission', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `RAI${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    const result = await callCallable<{
      ok: true;
      aiId: string;
      displayName: string;
    }>(
      'hostReplaceCaptainWithAi',
      { gameId, targetUid: guest.uid, skill: 'lieutenant' },
      host.idToken
    );

    expect(result.ok).toBe(true);
    expect(result.aiId.startsWith('ai:')).toBe(true);

    const snap = await db.collection('games').doc(gameId).get();
    const data = snap.data()!;
    expect(data.captainIds).toContain(result.aiId);
    expect(data.captainIds).not.toContain(guest.uid);
    expect(data.rated).toBe(false);
    expect(data.round.activePlayerId).toBe(host.uid);

    const aiHand = await db
      .collection('games')
      .doc(gameId)
      .collection('hands')
      .doc(result.aiId)
      .get();
    expect(aiHand.exists).toBe(true);
    expect(
      (aiHand.data()?.coordinates as unknown[] | undefined)?.length
    ).toBeGreaterThan(0);
  });

  it('hostLeaveWithAi replaces host seat and transfers command', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `LVA${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    const result = await callCallable<{
      ok: true;
      aiId: string;
      newHostId: string;
    }>('hostLeaveWithAi', { gameId, skill: 'ensign' }, host.idToken);

    expect(result.ok).toBe(true);
    expect(result.newHostId).toBe(guest.uid);
    expect(result.aiId.startsWith('ai:')).toBe(true);

    const snap = await db.collection('games').doc(gameId).get();
    const data = snap.data()!;
    expect(data.hostId).toBe(guest.uid);
    expect(data.captainIds).toContain(result.aiId);
    expect(data.captainIds).not.toContain(host.uid);
  });
});

describe('hostDropCaptain (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('drops a seat when enough captains remain', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const third = await createEmulatorUser({ displayName: 'Third' });
    const gameId = `DRP${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
        { id: third.uid, displayName: 'Third' },
      ],
      phase: 'active',
      paused: true,
    });

    const result = await callCallable<{
      ok: true;
      mode: string;
      remaining: number;
    }>(
      'hostDropCaptain',
      { gameId, targetUid: guest.uid, reason: 'e2e drop' },
      host.idToken
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('kicked');
    expect(result.remaining).toBe(2);

    const snap = await db.collection('games').doc(gameId).get();
    const data = snap.data()!;
    expect(data.captainIds).not.toContain(guest.uid);
    expect(data.paused).toBe(false);
    expect(data.rated).toBe(false);
  });

  it('soft-terminates when the fleet would drop below minimum', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `TRM${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    const result = await callCallable<{
      ok: true;
      mode: string;
    }>(
      'hostDropCaptain',
      { gameId, targetUid: guest.uid },
      host.idToken
    );

    expect(result.ok).toBe(true);
    expect(result.mode).toBe('terminated');

    const snap = await db.collection('games').doc(gameId).get();
    const data = snap.data()!;
    expect(data.opsTerminated).toBe(true);
    expect(data.phase).toBe('complete');
  });

  it('rejects unauthenticated drop', async () => {
    await expectCallableError(
      () =>
        callCallable('hostDropCaptain', {
          gameId: 'NOPE01',
          targetUid: 'x',
        }),
      'UNAUTHENTICATED'
    );
  });

  it('hostMuteInSector writes a sector mute doc', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `MUT${Date.now().toString(36).toUpperCase().slice(-6)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    const result = await callCallable<{ ok: true; muted: boolean }>(
      'hostMuteInSector',
      { gameId, uid: guest.uid, reason: 'e2e mute' },
      host.idToken
    );

    expect(result.ok).toBe(true);
    expect(result.muted).toBe(true);

    const mute = await db
      .collection('games')
      .doc(gameId)
      .collection('mutes')
      .doc(guest.uid)
      .get();
    expect(mute.exists).toBe(true);
    expect(mute.data()?.active).toBe(true);
    expect(mute.data()?.mode).toBe('hard');
  });
});

describe('callable error surface (emulator)', () => {
  it('surfaces HttpsError codes as CallableError', async () => {
    const host = await createEmulatorUser();
    try {
      await callCallable(
        'hostTransferHost',
        { gameId: 'MISSING', newHostId: 'x' },
        host.idToken
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(CallableError);
      expect((err as CallableError).code).toMatch(/NOT_FOUND|PERMISSION_DENIED/);
    }
  });
});
