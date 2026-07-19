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
  expectWaitingRoom,
  fillCallSign,
  gotoFleetMuster,
  joinSector,
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
        hostPage.getByText(/Rated sector — (quick hails only|free text is restricted)/i)
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

  test('host can configure go-out first-to + guest starter before launch', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();
    const pageErrors: string[] = [];
    hostPage.on('pageerror', (err) => pageErrors.push(err.message));
    hostPage.on('console', (msg) => {
      if (msg.type() === 'error') {
        pageErrors.push(msg.text());
      }
    });

    try {
      // Configure go-out on the muster form (createLobby path).
      await gotoFleetMuster(hostPage);
      await fillCallSign(hostPage, DEFAULT_HOST_CALLSIGN);
      await hostPage
        .getByRole('checkbox', { name: /Rated sector — results count toward TEI/ })
        .uncheck();
      await hostPage
        .locator('input[type="radio"][name="online-objective"][value="go-out"]')
        .check();
      await expect(
        hostPage.getByRole('group', { name: 'Go-out sector structure' })
      ).toBeVisible();
      await hostPage
        .locator('input[type="radio"][name="online-go-out-go-out-structure"][value="first-to"]')
        .check();
      await hostPage.getByLabel('Wins to win').selectOption('2');

      await hostPage.getByRole('button', { name: 'Open sector' }).click();
      await hostPage.waitForURL(/\/online\/[A-Z0-9]{6}$/);
      const sectorCode = hostPage.url().match(/\/online\/([A-Z0-9]{6})$/)![1]!;

      await joinSector(guestPage, DEFAULT_GUEST_CALLSIGN, sectorCode);
      await expectWaitingRoom(hostPage, sectorCode, 2);

      await expect
        .poll(
          async () => (await readGameDocument(sectorCode))?.objective ?? null,
          { timeout: 15_000 }
        )
        .toBe('go-out');
      await expect
        .poll(
          async () =>
            (await readGameDocument(sectorCode))?.goOutStructure ?? null,
          { timeout: 15_000 }
        )
        .toBe('first-to');
      await expect
        .poll(
          async () =>
            (await readGameDocument(sectorCode))?.goOutWinsToWin ?? null,
          { timeout: 15_000 }
        )
        .toBe(2);

      // Waiting-room setting write (same saveSettings path as objective).
      const starter = hostPage.getByLabel('First-round starter');
      await expect(starter).toBeEnabled({ timeout: 10_000 });
      await starter.selectOption({ label: DEFAULT_GUEST_CALLSIGN });
      await expect
        .poll(
          async () => {
            if (pageErrors.length) {
              throw new Error(`page errors: ${pageErrors.join(' | ')}`);
            }
            return (await readGameDocument(sectorCode))?.matchStarterIndex ?? null;
          },
          { timeout: 15_000 }
        )
        .toBe(1);

      await launchMission(hostPage);
      await expectBridgeTable(hostPage, sectorCode, DEFAULT_HOST_CALLSIGN);
      await expectBridgeTable(guestPage, sectorCode, DEFAULT_GUEST_CALLSIGN);

      const doc = (await readGameDocument(sectorCode))!;
      expect(doc.objective).toBe('go-out');
      expect(doc.goOutStructure).toBe('first-to');
      expect(doc.goOutWinsToWin).toBe(2);
      expect(doc.matchStarterIndex).toBe(1);
      const guestId = doc.captainIds.find((id) => id !== doc.hostId);
      expect(doc.round?.activePlayerId).toBe(guestId);
      expect(doc.round?.table?.spacedock?.placedBy).toBe(guestId);
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('host can switch victory objective in the waiting room', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, sectorCode } =
      await setupCasualTwoCaptainLobby(browser);

    try {
      const goOutRadio = hostPage.locator(
        'input[type="radio"][name="waiting-objective"][value="go-out"]'
      );
      await expect(goOutRadio).toBeEnabled({ timeout: 15_000 });
      await goOutRadio.click();
      await expect
        .poll(
          async () => (await readGameDocument(sectorCode))?.objective ?? null,
          { timeout: 15_000 }
        )
        .toBe('go-out');
      await expect(goOutRadio).toBeChecked({ timeout: 10_000 });
      await expect(
        hostPage.getByRole('group', { name: 'Go-out sector structure' })
      ).toBeVisible();

      const pointsRadio = hostPage.locator(
        'input[type="radio"][name="waiting-objective"][value="points"]'
      );
      await pointsRadio.click();
      await expect
        .poll(
          async () => (await readGameDocument(sectorCode))?.objective ?? null,
          { timeout: 15_000 }
        )
        .toBe('points');
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });
});
