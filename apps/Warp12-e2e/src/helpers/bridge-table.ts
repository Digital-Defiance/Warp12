import { expect, type Browser, type Page } from '@playwright/test';

import {
  closeLobbyContexts,
  expectBridgeTable,
  expectWaitingRoom,
  fillCallSign,
  gotoFleetMuster,
  joinSector,
  launchMission,
  setupTwoCaptainLobby,
  type TwoCaptainLobby,
  waitForOnlineReady,
} from './online-lobby.js';

/** Round-1 starter comes from matchStarterIndex (any seat, human or AI). */
export const DEFAULT_HOST_CALLSIGN = 'Captain Pike';
export const DEFAULT_GUEST_CALLSIGN = 'Captain Kirk';

export async function expectActiveHelm(
  page: Page,
  callSign: string,
  timeout = 30_000
): Promise<void> {
  const helm = page.locator('dt', { hasText: 'Helm' }).locator('xpath=following-sibling::dd[1]');
  await expect(helm).toHaveText(callSign, { timeout });
}

export async function expectCaptainTurn(
  page: Page,
  callSign: string,
  timeout = 30_000
): Promise<void> {
  await expect(page.getByText(`${callSign} · your turn`)).toBeVisible({ timeout });
}

export async function expectAwaitingCaptain(
  page: Page,
  callSign: string,
  timeout = 30_000
): Promise<void> {
  await expect(page.getByText(`Awaiting ${callSign}`)).toBeVisible({ timeout });
}

export async function expectNotYourTurn(page: Page, callSign: string): Promise<void> {
  await expect(page.getByText(`${callSign} · your turn`)).not.toBeVisible();
}

async function helmCallSign(page: Page): Promise<string> {
  const helm = page.locator('dt', { hasText: 'Helm' }).locator('xpath=following-sibling::dd[1]');
  return ((await helm.textContent()) ?? '').trim();
}

/** Chart the first legal tile; prefers Neutral Zone then own warp trail (round-one safe). */
export async function playMoveOnOwnTrail(
  page: Page,
  callSign: string
): Promise<void> {
  const helmBefore = await helmCallSign(page);
  const withTwelve = page.locator(
    'button[data-playable="true"][aria-label*="-12"], button[data-playable="true"][aria-label^="Coordinate 12-"]'
  );
  const candidates =
    (await withTwelve.count()) > 0
      ? withTwelve
      : page.locator('button[data-playable="true"]');
  const count = await candidates.count();
  if (count === 0) {
    throw new Error('No playable coordinates in hand');
  }

  for (let index = 0; index < count; index += 1) {
    const tile = candidates.nth(index);
    await tile.click({ force: true });

    const routeCandidates = [
      page.getByRole('button', { name: 'Play on Neutral zone' }),
      page.getByRole('button', { name: `Play on Warp trail · ${callSign}` }),
      page.getByRole('button', { name: /^Play on / }).first(),
    ];

    let clickedRoute = false;
    for (const routeButton of routeCandidates) {
      if (await routeButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await routeButton.click({ force: true });
        clickedRoute = true;
        break;
      }
    }
    if (!clickedRoute) {
      await tile.click({ force: true });
    }

    const alert = page.getByRole('alert');
    if (await alert.isVisible({ timeout: 1000 }).catch(() => false)) {
      const message = (await alert.textContent()) ?? 'unknown error';
      await page.getByRole('button', { name: 'Cancel' }).click().catch(() => undefined);
      throw new Error(`Move rejected: ${message}`);
    }

    await expect(page.getByText('Subspace IWGF link active')).toBeVisible({ timeout: 20_000 });
    try {
      await expect
        .poll(async () => helmCallSign(page), { timeout: 15_000 })
        .not.toBe(helmBefore);
      return;
    } catch {
      await page.getByRole('button', { name: 'Cancel' }).click().catch(() => undefined);
    }
  }

  throw new Error(`Could not chart a coordinate for ${callSign}`);
}

/** @deprecated prefer playMoveOnOwnTrail for multiplayer tests */
export async function playFirstLegalMove(page: Page, callSign?: string): Promise<void> {
  if (callSign) {
    await playMoveOnOwnTrail(page, callSign);
    return;
  }
  await playMoveOnOwnTrail(page, await helmCallSign(page));
}

export async function openSubspaceComms(page: Page): Promise<void> {
  const openButton = page.getByRole('button', { name: 'Open subspace comms' });
  if (await openButton.isVisible().catch(() => false)) {
    await openButton.click();
  }
  await expect(page.getByRole('region', { name: 'Subspace comms' })).toBeVisible();
}

export async function sendQuickHail(page: Page, phrase: string): Promise<void> {
  await openSubspaceComms(page);
  await page.getByRole('toolbar', { name: 'Quick comms' }).getByRole('button', { name: 'Get moving' }).click();
  await page.getByRole('menuitem', { name: phrase }).click();
}

export async function sendFreeformHail(page: Page, text: string): Promise<void> {
  await openSubspaceComms(page);
  await page.getByPlaceholder('Open hailing frequencies…').fill(text);
  await page.getByRole('button', { name: 'Transmit' }).click();
}

export async function openCasualSector(page: Page, callSign: string): Promise<string> {
  await gotoFleetMuster(page);
  await fillCallSign(page, callSign);
  await page
    .getByRole('checkbox', { name: /Rated sector — results count toward TEI/ })
    .uncheck();
  await page.getByRole('button', { name: 'Open sector' }).click();
  await page.waitForURL(/\/online\/[A-Z0-9]{6}$/);
  const match = page.url().match(/\/online\/([A-Z0-9]{6})$/);
  if (!match) {
    throw new Error(`Expected sector URL after open; got ${page.url()}`);
  }
  return match[1];
}

export async function setupCasualTwoCaptainLobby(
  browser: Browser,
  hostCallSign = DEFAULT_HOST_CALLSIGN,
  guestCallSign = DEFAULT_GUEST_CALLSIGN
): Promise<TwoCaptainLobby> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  const sectorCode = await openCasualSector(hostPage, hostCallSign);
  await joinSector(guestPage, guestCallSign, sectorCode);
  await expectWaitingRoom(hostPage, sectorCode, 2);
  await expectWaitingRoom(guestPage, sectorCode, 2);

  return { hostContext, guestContext, hostPage, guestPage, sectorCode };
}

export async function setupActiveMission(
  browser: Browser,
  hostCallSign = DEFAULT_HOST_CALLSIGN,
  guestCallSign = DEFAULT_GUEST_CALLSIGN
): Promise<TwoCaptainLobby> {
  const lobby = await setupTwoCaptainLobby(browser, hostCallSign, guestCallSign);
  await launchMission(lobby.hostPage);
  await expectBridgeTable(lobby.hostPage, lobby.sectorCode, hostCallSign);
  await expectBridgeTable(lobby.guestPage, lobby.sectorCode, guestCallSign);
  return lobby;
}

export async function readUnchartedCount(page: Page): Promise<number> {
  const row = page.locator('dt', { hasText: 'Uncharted' }).locator('xpath=following-sibling::dd[1]');
  const text = (await row.textContent())?.trim() ?? '';
  const value = Number.parseInt(text, 10);
  if (Number.isNaN(value)) {
    throw new Error(`Could not parse Uncharted count from "${text}"`);
  }
  return value;
}

export async function joinSectorWithDuplicateCallSign(
  page: Page,
  callSign: string,
  sectorCode: string
): Promise<void> {
  await page.goto(`/online/${sectorCode}`);
  await expect(
    page.getByRole('heading', { name: `Join sector ${sectorCode}` })
  ).toBeVisible();
  await fillCallSign(page, callSign);
  await waitForOnlineReady(page, 'Join sector');
  await page.getByRole('button', { name: 'Join sector' }).click();
  await page.waitForURL(new RegExp(`/online/${sectorCode}$`));
}

export { closeLobbyContexts, setupTwoCaptainLobby, type TwoCaptainLobby };
