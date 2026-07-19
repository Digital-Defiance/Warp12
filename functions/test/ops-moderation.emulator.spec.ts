import { beforeAll, describe, expect, it } from 'vitest';

import {
  callCallable,
  createEmulatorUser,
  ensureEmulatorAdmin,
  expectCallableError,
} from './emulator-harness.js';
import { seedActiveGame } from './seed-active-game.js';

describe('ops mute / ban callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('muteUser / getMute / unmuteUser as moderator', async () => {
    const db = ensureEmulatorAdmin();
    const mod = await createEmulatorUser({
      displayName: 'Mod',
      roles: ['moderator'],
    });
    const target = await createEmulatorUser({ displayName: 'Target' });

    const muted = await callCallable<{
      ok: true;
      muted: boolean;
      mode: string;
    }>(
      'muteUser',
      { uid: target.uid, reason: 'e2e spam', mode: 'hard' },
      mod.idToken
    );
    expect(muted.ok).toBe(true);
    expect(muted.muted).toBe(true);
    expect(muted.mode).toBe('hard');

    const snap = await db.collection('mutes').doc(target.uid).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.active).toBe(true);

    const got = await callCallable<{ ok: true; mute: { active: boolean } | null }>(
      'getMute',
      { uid: target.uid },
      mod.idToken
    );
    expect(got.mute?.active).toBe(true);

    const unmuted = await callCallable<{ ok: true; muted: boolean }>(
      'unmuteUser',
      { uid: target.uid },
      mod.idToken
    );
    expect(unmuted.muted).toBe(false);

    const after = await db.collection('mutes').doc(target.uid).get();
    expect(after.data()?.active).toBe(false);
  });

  it('rejects muteUser without moderator role', async () => {
    const civilian = await createEmulatorUser({ displayName: 'Civilian' });
    const target = await createEmulatorUser({ displayName: 'Target' });

    await expectCallableError(
      () =>
        callCallable(
          'muteUser',
          { uid: target.uid, reason: 'nope' },
          civilian.idToken
        ),
      'PERMISSION_DENIED'
    );
  });

  it('banUser / getBan / unbanUser as admin', async () => {
    const db = ensureEmulatorAdmin();
    const adminUser = await createEmulatorUser({
      displayName: 'Admin',
      roles: ['admin'],
    });
    const target = await createEmulatorUser({ displayName: 'Banned' });

    const banned = await callCallable<{ ok: true; ban: { banId: string } }>(
      'banUser',
      {
        uid: target.uid,
        reason: 'e2e ban',
        disableAuth: false,
      },
      adminUser.idToken
    );
    expect(banned.ok).toBe(true);
    expect(banned.ban.banId).toBe(target.uid);

    const snap = await db.collection('bans').doc(target.uid).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.active).toBe(true);

    const got = await callCallable<{
      ok: true;
      banned: boolean;
      ban: { active: boolean } | null;
    }>('getBan', { uid: target.uid }, adminUser.idToken);
    expect(got.banned).toBe(true);
    expect(got.ban?.active).toBe(true);

    const unbanned = await callCallable<{ ok: true }>(
      'unbanUser',
      { uid: target.uid, reenableAuth: false },
      adminUser.idToken
    );
    expect(unbanned.ok).toBe(true);

    const after = await db.collection('bans').doc(target.uid).get();
    expect(after.data()?.active).toBe(false);
  });

  it('moderator cannot banUser (admin-only)', async () => {
    const mod = await createEmulatorUser({
      displayName: 'ModOnly',
      roles: ['moderator'],
    });
    const target = await createEmulatorUser({ displayName: 'Target' });

    await expectCallableError(
      () =>
        callCallable(
          'banUser',
          { uid: target.uid, reason: 'should fail' },
          mod.idToken
        ),
      'PERMISSION_DENIED'
    );
  });
});

describe('moderation report callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('submitModerationReport from a seated captain', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `REP${Date.now().toString(36).toUpperCase().slice(-5)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    const result = await callCallable<{ ok: true; reportId: string }>(
      'submitModerationReport',
      {
        gameId,
        subjectType: 'captain',
        targetUid: guest.uid,
        category: 'harassment',
        reason: 'e2e report for harness coverage',
      },
      host.idToken
    );

    expect(result.ok).toBe(true);
    expect(result.reportId.length).toBeGreaterThan(8);

    const report = await db
      .collection('moderationReports')
      .doc(result.reportId)
      .get();
    expect(report.exists).toBe(true);
    expect(report.data()?.reporterUid).toBe(host.uid);
    expect(report.data()?.targetUid).toBe(guest.uid);
  });

  it('rejects report from a non-captain', async () => {
    const db = ensureEmulatorAdmin();
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const outsider = await createEmulatorUser({ displayName: 'Outsider' });
    const gameId = `NRP${Date.now().toString(36).toUpperCase().slice(-5)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
    });

    await expectCallableError(
      () =>
        callCallable(
          'submitModerationReport',
          {
            gameId,
            subjectType: 'sector',
            category: 'other',
            reason: 'not aboard',
          },
          outsider.idToken
        ),
      'PERMISSION_DENIED'
    );
  });
});
