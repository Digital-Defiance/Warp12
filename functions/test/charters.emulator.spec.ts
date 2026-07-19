import { beforeAll, describe, expect, it } from 'vitest';

import {
  callCallable,
  createEmulatorUser,
  ensureEmulatorAdmin,
  expectCallableError,
} from './emulator-harness.js';

describe('charter callables (emulator)', () => {
  beforeAll(() => {
    ensureEmulatorAdmin();
  });

  it('createCharter / getCharter / listMyCharters', async () => {
    const db = ensureEmulatorAdmin();
    const owner = await createEmulatorUser({ displayName: 'Owner' });
    const slug = `e2e-crew-${Date.now().toString(36)}`;

    const created = await callCallable<{
      charterId: string;
      slug: string;
      name: string;
      inviteToken: string;
      crewCode: string;
      memberCount: number;
    }>(
      'createCharter',
      {
        name: 'E2E Test Crew',
        slug,
        objective: 'points',
        playerCount: 4,
      },
      owner.idToken
    );

    expect(created.charterId).toBeTruthy();
    expect(created.slug).toBe(slug);
    expect(created.memberCount).toBe(1);
    expect(created.inviteToken.length).toBeGreaterThanOrEqual(8);
    expect(created.crewCode.length).toBeGreaterThan(4);

    const snap = await db.collection('charters').doc(created.charterId).get();
    expect(snap.exists).toBe(true);
    expect(snap.data()?.createdBy).toBe(owner.uid);

    const got = await callCallable<{
      charter: { charterId: string; name: string };
    }>('getCharter', { charterId: created.charterId }, owner.idToken);
    expect(got.charter.name).toBe('E2E Test Crew');

    const listed = await callCallable<{
      charters: { charterId: string }[];
    }>('listMyCharters', {}, owner.idToken);
    expect(listed.charters.some((c) => c.charterId === created.charterId)).toBe(
      true
    );
  });

  it('joinCharter via invite token then leaveCharter', async () => {
    const owner = await createEmulatorUser({ displayName: 'Owner' });
    const joiner = await createEmulatorUser({ displayName: 'Joiner' });
    const slug = `e2e-join-${Date.now().toString(36)}`;

    const created = await callCallable<{
      charterId: string;
      inviteToken: string;
    }>(
      'createCharter',
      {
        name: 'Joinable Crew',
        slug,
        objective: 'go-out',
        playerCount: 4,
      },
      owner.idToken
    );

    const joined = await callCallable<{
      ok: true;
      charter: { charterId: string; memberCount: number };
    }>(
      'joinCharter',
      {
        charterId: created.charterId,
        inviteToken: created.inviteToken,
      },
      joiner.idToken
    );

    expect(joined.ok).toBe(true);
    expect(joined.charter.charterId).toBe(created.charterId);
    expect(joined.charter.memberCount).toBe(2);

    // Owner cannot leave while another member remains.
    await expectCallableError(
      () =>
        callCallable(
          'leaveCharter',
          { charterId: created.charterId },
          owner.idToken
        ),
      'FAILED_PRECONDITION'
    );

    const left = await callCallable<{ ok: true }>(
      'leaveCharter',
      { charterId: created.charterId },
      joiner.idToken
    );
    expect(left.ok).toBe(true);
  });

  it('solo owner can leaveCharter', async () => {
    const owner = await createEmulatorUser({ displayName: 'Solo' });
    const slug = `e2e-solo-${Date.now().toString(36)}`;

    const created = await callCallable<{ charterId: string }>(
      'createCharter',
      {
        name: 'Solo Crew',
        slug,
        objective: 'points',
        playerCount: 4,
      },
      owner.idToken
    );

    const left = await callCallable<{ ok: true }>(
      'leaveCharter',
      { charterId: created.charterId },
      owner.idToken
    );
    expect(left.ok).toBe(true);
  });

  it('rejects createCharter without auth', async () => {
    await expectCallableError(
      () =>
        callCallable('createCharter', {
          name: 'No Auth',
          slug: 'no-auth',
          objective: 'points',
        }),
      'UNAUTHENTICATED'
    );
  });
});
