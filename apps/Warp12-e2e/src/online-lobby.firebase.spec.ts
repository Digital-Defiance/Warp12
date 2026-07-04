import { test, expect } from '@playwright/test';

import {
  closeLobbyContexts,
  expectWaitingRoom,
  fillCallSign,
  joinSector,
  joinSectorViaLink,
  openSector,
  setupTwoCaptainLobby,
  waitForOnlineReady,
} from './helpers/online-lobby.js';

test.describe('online fleet (Firebase emulators)', () => {
  test('host opens a sector and guest joins the waiting room', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const sectorCode = await openSector(hostPage, 'Captain Pike');
      await expectWaitingRoom(hostPage, sectorCode, 1);
      await expect(hostPage.getByText('Captain Pike · Host')).toBeVisible();

      await joinSector(guestPage, 'Captain Kirk', sectorCode);
      await expectWaitingRoom(guestPage, sectorCode, 2);
      await expect(
        guestPage.getByRole('listitem').filter({ hasText: 'Captain Kirk' })
      ).toBeVisible();
      await expect(guestPage.getByText('Awaiting host to launch')).toBeVisible();

      await expect(
        hostPage.getByRole('listitem').filter({ hasText: 'Captain Kirk' })
      ).toBeVisible();
      await expect(
        hostPage.getByRole('button', { name: 'Launch mission' })
      ).toBeVisible();
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('guest can board via a direct sector link', async ({ browser }) => {
    const hostContext = await browser.newContext();
    const guestContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const guestPage = await guestContext.newPage();

    try {
      const sectorCode = await openSector(hostPage, 'Captain Sulu');
      await joinSectorViaLink(guestPage, 'Captain Uhura', sectorCode);
      await expectWaitingRoom(guestPage, sectorCode, 2);
      await expect(
        guestPage.getByRole('listitem').filter({ hasText: 'Captain Uhura' })
      ).toBeVisible();
      await expectWaitingRoom(hostPage, sectorCode, 2);
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('joining an unknown sector code shows an error', async ({ page }) => {
    await page.goto('/online');
    await expect(page.getByRole('heading', { name: 'Fleet muster' })).toBeVisible();
    await fillCallSign(page, 'Captain Rand');
    await page.getByPlaceholder('ABC123').fill('ZZZZZZ');
    await waitForOnlineReady(page, 'Join sector');
    await page.getByRole('button', { name: 'Join sector' }).click();
    await expect(page.getByRole('alert')).toContainText('Game not found');
  });

  test('opening an unknown sector URL shows sector unavailable', async ({
    page,
  }) => {
    await page.goto('/online/ZZZZZZ');
    await expect(page.getByRole('heading', { name: 'Sector ZZZZZZ' })).toBeVisible();
    await expect(page.getByText('No sector found with that code')).toBeVisible();
  });

  test('guest can leave the waiting room', async ({ browser }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupTwoCaptainLobby(browser);

    try {
      await guestPage.getByRole('button', { name: 'Leave sector' }).click();
      await expect(guestPage).toHaveURL(/\/online$/);
      await expectWaitingRoom(hostPage, sectorCode, 1);
      await expect(
        hostPage.getByRole('button', { name: 'Launch mission' })
      ).toBeDisabled();
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });

  test('host cancel removes the sector for remaining captains', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupTwoCaptainLobby(browser);

    try {
      await hostPage.getByRole('button', { name: 'Cancel sector' }).click();
      await expect(hostPage).toHaveURL(/\/online$/);
      await expect(
        guestPage.getByText('No sector found with that code')
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        guestPage.getByRole('heading', { name: `Sector ${sectorCode}` })
      ).toBeVisible();
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });
});
