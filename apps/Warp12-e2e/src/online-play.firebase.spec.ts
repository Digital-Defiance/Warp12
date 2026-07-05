import { test, expect } from '@playwright/test';

import {
  closeLobbyContexts,
  DEFAULT_GUEST_CALLSIGN,
  DEFAULT_HOST_CALLSIGN,
  expectActiveHelm,
  openSubspaceComms,
  readUnchartedCount,
  sendFreeformHail,
  sendQuickHail,
  setupActiveMission,
  setupCasualTwoCaptainLobby,
  joinSectorWithDuplicateCallSign,
} from './helpers/bridge-table.js';
import {
  captainName,
  readGameDocument,
  readMessages,
  readPrivateHand,
} from './helpers/firestore-emulator.js';
import {
  expectBridgeTable,
  launchMission,
  openSector,
} from './helpers/online-lobby.js';

test.describe('online play (Firebase emulators)', () => {
  test('launch writes active sector state with dealt hands in Firestore', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupActiveMission(browser);

    try {
      await expect
        .poll(async () => readGameDocument(sectorCode), { timeout: 15_000 })
        .not.toBeNull();

      const doc = (await readGameDocument(sectorCode))!;
      expect(doc.phase).toBe('active');
      expect(doc.captainIds).toHaveLength(2);
      expect(doc.round?.phase).toBe('playing');
      expect(doc.round?.roundNumber).toBe(1);
      expect(doc.round?.activePlayerId).toBe(doc.hostId);

      const hostHand = await readPrivateHand(sectorCode, doc.hostId);
      const guestId = doc.captainIds.find((id) => id !== doc.hostId);
      expect(guestId).toBeTruthy();
      const guestHand = await readPrivateHand(sectorCode, guestId!);
      expect(hostHand?.length).toBeGreaterThan(0);
      expect(guestHand?.length).toBeGreaterThan(0);

      const activeName = captainName(doc, doc.round!.activePlayerId);
      await expectActiveHelm(hostPage, activeName);
      await expectActiveHelm(guestPage, activeName);
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('uncharted sector count matches Firestore on both bridge tables', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupActiveMission(browser);

    try {
      const doc = (await readGameDocument(sectorCode))!;
      const expected = doc.round?.unchartedSectors.length ?? 0;
      expect(expected).toBeGreaterThan(0);
      expect(await readUnchartedCount(hostPage)).toBe(expected);
      expect(await readUnchartedCount(guestPage)).toBe(expected);
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('quick hail phrases persist in Firestore and reach the guest UI', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupActiveMission(browser);

    try {
      await openSubspaceComms(guestPage);
      await sendQuickHail(hostPage, 'Engage!');

      await expect
        .poll(async () => readMessages(sectorCode), { timeout: 30_000 })
        .toEqual(
          expect.arrayContaining([
            expect.objectContaining({ phraseId: 'move-engage', fromName: DEFAULT_HOST_CALLSIGN }),
          ])
        );

      const guestComms = guestPage.getByRole('region', { name: 'Subspace comms' });
      await expect(guestComms.getByText('Engage!')).toBeVisible({ timeout: 15_000 });
      await openSubspaceComms(hostPage);
      await expect(
        hostPage.getByText('Rated sector — comms restricted to quick hails during active play.')
      ).toBeVisible();
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('casual sectors allow free-form subspace messages during play', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupCasualTwoCaptainLobby(browser);

    try {
      await launchMission(hostPage);
      await expectBridgeTable(hostPage, sectorCode, DEFAULT_HOST_CALLSIGN);
      await expectBridgeTable(guestPage, sectorCode, DEFAULT_GUEST_CALLSIGN);

      const hail = 'Testing open hailing frequencies.';
      await sendFreeformHail(hostPage, hail);

      await expect
        .poll(async () => readMessages(sectorCode), { timeout: 30_000 })
        .toEqual(
          expect.arrayContaining([expect.objectContaining({ text: hail })])
        );

      await openSubspaceComms(guestPage);
      await expect(guestPage.getByText(hail)).toBeVisible({ timeout: 15_000 });
      await expect(
        hostPage.getByPlaceholder('Open hailing frequencies…')
      ).toBeVisible();
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('captains cannot board a sector after launch', async ({ browser }) => {
    const { hostContext, guestContext, sectorCode } = await setupActiveMission(browser);

    const lateContext = await browser.newContext();
    const latePage = await lateContext.newPage();

    try {
      await latePage.goto(`/online/${sectorCode}`);
      await expect(
        latePage.getByText('This mission is already underway')
      ).toBeVisible({ timeout: 15_000 });
      await expect(latePage.getByRole('button', { name: 'Join sector' })).toHaveCount(
        0
      );
    } finally {
      await closeLobbyContexts(hostContext, guestContext, lateContext);
    }
  });

  test('duplicate call signs are auto-adjusted when joining', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const sectorCode = await openSector(hostPage, DEFAULT_HOST_CALLSIGN);

      await joinSectorWithDuplicateCallSign(
        guestPage,
        DEFAULT_HOST_CALLSIGN,
        sectorCode
      );

      await expect(guestPage.getByText(/Call sign adjusted to/)).toBeVisible();
      await expect(
        guestPage.getByRole('listitem').filter({ hasText: 'Captain Pike (2)' })
      ).toBeVisible();
      await expect(hostPage.getByText('Captain Pike · Host')).toBeVisible();
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });
});
