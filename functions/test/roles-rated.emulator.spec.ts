import { beforeAll, describe, expect, it } from 'vitest';

import {
  callCallable,
  createEmulatorUser,
  ensureEmulatorAdmin,
  expectCallableError,
} from './emulator-harness.js';
import { seedActiveGame } from './seed-active-game.js';

const BOOTSTRAP_SECRET =
  process.env.BOOTSTRAP_ADMIN_SECRET ?? 'e2e-bootstrap-admin-secret';

describe('roles / rated-match callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('getMyRoles returns empty roles for a fresh captain', async () => {
    const user = await createEmulatorUser({ displayName: 'Fresh' });
    const result = await callCallable<{ roles: string[] }>(
      'getMyRoles',
      {},
      user.idToken
    );
    expect(result.roles).toEqual([]);
  });

  it('bootstrapAdmin grants admin with the emulator secret', async () => {
    const user = await createEmulatorUser({ displayName: 'Bootstrap' });

    await expectCallableError(
      () =>
        callCallable(
          'bootstrapAdmin',
          { secret: 'wrong-secret' },
          user.idToken
        ),
      'PERMISSION_DENIED'
    );

    const result = await callCallable<{
      ok: true;
      roles: string[];
    }>(
      'bootstrapAdmin',
      { secret: BOOTSTRAP_SECRET },
      user.idToken
    );
    expect(result.ok).toBe(true);
    expect(result.roles).toContain('admin');

    // Claims are on Auth; getMyRoles reads the request token (stale until refresh).
    const { getAuth } = await import('firebase-admin/auth');
    const record = await getAuth().getUser(user.uid);
    expect((record.customClaims?.roles as string[] | undefined) ?? []).toContain(
      'admin'
    );
  });

  it('setUserRoles and createRatedMatch as match_official', async () => {
    const adminUser = await createEmulatorUser({
      displayName: 'Admin',
      roles: ['admin'],
    });
    const official = await createEmulatorUser({ displayName: 'Official' });

    const setRoles = await callCallable<{ ok: true; roles: string[] }>(
      'setUserRoles',
      { uid: official.uid, roles: ['match_official'] },
      adminUser.idToken
    );
    expect(setRoles.roles).toEqual(['match_official']);

    // Fresh token so requireOfficial sees match_official claim.
    const officialFresh = await createEmulatorUser({
      uid: official.uid,
      displayName: 'Official',
      roles: ['match_official'],
    });

    const match = await callCallable<{
      matchCode: string;
      status: string;
    }>(
      'createRatedMatch',
      {
        objective: 'points',
        campaignRounds: 4,
        venue: 'e2e emulator',
      },
      officialFresh.idToken
    );

    expect(match.matchCode).toMatch(/^MT-[A-Z0-9]+$/);
    expect(match.status).toBe('open');

    const db = ensureEmulatorAdmin();
    const snap = await db.collection('ratedMatches').doc(match.matchCode).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.objective).toBe('points');
  });

  it('setUserRoles refuses to remove the actors own admin role', async () => {
    const adminUser = await createEmulatorUser({
      displayName: 'SelfAdmin',
      roles: ['admin'],
    });

    await expectCallableError(
      () =>
        callCallable(
          'setUserRoles',
          { uid: adminUser.uid, roles: ['moderator'] },
          adminUser.idToken
        ),
      'FAILED_PRECONDITION'
    );

    const { getAuth } = await import('firebase-admin/auth');
    const record = await getAuth().getUser(adminUser.uid);
    expect((record.customClaims?.roles as string[] | undefined) ?? []).toContain(
      'admin'
    );
  });

  it('setUserRoles can demote another admin', async () => {
    const actor = await createEmulatorUser({
      displayName: 'ActorAdmin',
      roles: ['admin'],
    });
    const target = await createEmulatorUser({
      displayName: 'OtherAdmin',
      roles: ['admin'],
    });

    const result = await callCallable<{ ok: true; roles: string[] }>(
      'setUserRoles',
      { uid: target.uid, roles: ['moderator'] },
      actor.idToken
    );
    expect(result.roles).toEqual(['moderator']);

    const { getAuth } = await import('firebase-admin/auth');
    const record = await getAuth().getUser(target.uid);
    expect(record.customClaims?.roles).toEqual(['moderator']);
  });

  it('setAcademyPlacement writes starting rating once', async () => {
    const user = await createEmulatorUser({ displayName: 'Cadet' });

    const result = await callCallable<{ ok: true }>(
      'setAcademyPlacement',
      { objective: 'points', skill: 'ensign' },
      user.idToken
    );
    expect(result.ok).toBe(true);

    const db = ensureEmulatorAdmin();
    const stats = await db.collection('playerStats').doc(user.uid).get();
    expect(stats.exists).toBe(true);

    await expectCallableError(
      () =>
        callCallable(
          'setAcademyPlacement',
          { objective: 'points', skill: 'lieutenant' },
          user.idToken
        ),
      'FAILED_PRECONDITION'
    );
  });
});

describe('ops games callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('listActiveGames and getOpsGame as moderator', async () => {
    const db = ensureEmulatorAdmin();
    const mod = await createEmulatorUser({
      displayName: 'Mod',
      roles: ['moderator'],
    });
    const host = await createEmulatorUser({ displayName: 'Host' });
    const guest = await createEmulatorUser({ displayName: 'Guest' });
    const gameId = `OPS${Date.now().toString(36).toUpperCase().slice(-5)}`;

    await seedActiveGame(db, {
      gameId,
      hostId: host.uid,
      captains: [
        { id: host.uid, displayName: 'Host' },
        { id: guest.uid, displayName: 'Guest' },
      ],
      phase: 'active',
    });

    const listed = await callCallable<{
      ok: true;
      games: { id: string }[];
    }>('listActiveGames', { limit: 50 }, mod.idToken);
    expect(listed.ok).toBe(true);
    expect(listed.games.some((g) => g.id === gameId)).toBe(true);

    const got = await callCallable<{
      ok: true;
      game: { id: string; hostId: string };
    }>('getOpsGame', { gameId }, mod.idToken);
    expect(got.game.hostId).toBe(host.uid);
  });

  it('rejects listActiveGames without moderator', async () => {
    const civilian = await createEmulatorUser({ displayName: 'Civilian' });
    await expectCallableError(
      () => callCallable('listActiveGames', {}, civilian.idToken),
      'PERMISSION_DENIED'
    );
  });
});
