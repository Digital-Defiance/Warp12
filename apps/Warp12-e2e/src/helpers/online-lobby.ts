import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

/** Wait until anonymous auth is ready and a lobby action is enabled. */
export async function waitForOnlineReady(
  page: Page,
  actionName: RegExp | string = /Open sector|Join sector/
): Promise<void> {
  await expect(page.getByText('Firebase is not configured')).not.toBeVisible();
  const callSignField = page.getByPlaceholder('Captain name');
  if ((await callSignField.inputValue()).trim() === '') {
    await callSignField.fill('E2E Probe');
  }
  await expect(page.getByRole('button', { name: actionName })).toBeEnabled({
    timeout: 20_000,
  });
}

/** @deprecated use waitForOnlineReady */
export const waitForFirebaseReady = waitForOnlineReady;

export async function gotoFleetMuster(page: Page): Promise<void> {
  await page.goto('/online');
  await expect(page.getByRole('heading', { name: 'Fleet muster' })).toBeVisible();
  await waitForOnlineReady(page, 'Open sector');
}

export async function fillCallSign(page: Page, callSign: string): Promise<void> {
  await page.getByPlaceholder('Captain name').fill(callSign);
}

export async function openSector(page: Page, callSign: string): Promise<string> {
  await gotoFleetMuster(page);
  await fillCallSign(page, callSign);
  await page.getByRole('button', { name: 'Open sector' }).click();
  await page.waitForURL(/\/online\/[A-Z0-9]{6}$/);
  const match = page.url().match(/\/online\/([A-Z0-9]{6})$/);
  if (!match) {
    throw new Error(`Expected sector URL after open; got ${page.url()}`);
  }
  return match[1];
}

export async function joinSector(
  page: Page,
  callSign: string,
  sectorCode: string
): Promise<void> {
  await gotoFleetMuster(page);
  await fillCallSign(page, callSign);
  await page.getByPlaceholder('ABC123').fill(sectorCode);
  await page.getByRole('button', { name: 'Join sector' }).click();
  await page.waitForURL(new RegExp(`/online/${sectorCode}$`));
}

export async function joinSectorViaLink(
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

export async function expectWaitingRoom(
  page: Page,
  sectorCode: string,
  captainCount: number
): Promise<void> {
  await expect(
    page.getByRole('heading', { name: `Sector ${sectorCode}` })
  ).toBeVisible();
  await expect(
    page.getByText(`${captainCount}/`, { exact: false })
  ).toBeVisible();
}

export async function launchMission(page: Page): Promise<void> {
  const launchButton = page.getByRole('button', { name: 'Launch mission' });
  await expect(launchButton).toBeEnabled({ timeout: 10_000 });
  await launchButton.click();
  const softGate = page.getByText(/Sign in with Google before launching a rated sector/i);
  if (await softGate.isVisible({ timeout: 1_500 }).catch(() => false)) {
    throw new Error(
      'Launch blocked by rated soft-gate — call verifyE2eAccount(page) on the host first'
    );
  }
  await page.waitForURL(/\/online\/[A-Z0-9]{6}\/play$/, { timeout: 30_000 });
}

/**
 * Auth emulator / e2e: arm rated-launch bypass (and best-effort Google link).
 * Requires the bridge build with Vite `--mode e2e` (installs window hook).
 */
export async function verifyE2eAccount(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      typeof (
        window as Window & { __warp12E2eVerifyAccount?: unknown }
      ).__warp12E2eVerifyAccount === 'function',
    undefined,
    { timeout: 20_000 }
  );
  await page.evaluate(async () => {
    const w = window as Window & {
      __warp12E2eVerifyAccount?: () => Promise<unknown>;
      __warp12E2eAllowRatedLaunch?: boolean;
    };
    w.__warp12E2eAllowRatedLaunch = true;
    const hook = w.__warp12E2eVerifyAccount;
    if (!hook) {
      throw new Error(
        '__warp12E2eVerifyAccount hook missing (build with --mode e2e)'
      );
    }
    await hook();
  });
  await page.waitForFunction(
    () =>
      (window as Window & { __warp12E2eAllowRatedLaunch?: boolean })
        .__warp12E2eAllowRatedLaunch === true
  );
}

export async function expectBridgeTable(
  page: Page,
  sectorCode: string,
  callSign: string
): Promise<void> {
  await expect(page).toHaveURL(new RegExp(`/online/${sectorCode}/play$`));
  await expect(page.getByText(`Sector ${sectorCode} · ${callSign}`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText('Subspace IWGF link active')).toBeVisible({
    timeout: 20_000,
  });
  await expect(
    page.getByRole('heading', { name: `${callSign}'s coordinates` })
  ).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText('Sector status')).toBeVisible();
}

export interface TwoCaptainLobby {
  hostContext: BrowserContext;
  guestContext: BrowserContext;
  hostPage: Page;
  guestPage: Page;
  sectorCode: string;
}

export async function setupTwoCaptainLobby(
  browser: Browser,
  hostCallSign = 'Captain Pike',
  guestCallSign = 'Captain Kirk'
): Promise<TwoCaptainLobby> {
  const hostContext = await browser.newContext();
  const guestContext = await browser.newContext();
  const hostPage = await hostContext.newPage();
  const guestPage = await guestContext.newPage();

  const sectorCode = await openSector(hostPage, hostCallSign);
  await joinSector(guestPage, guestCallSign, sectorCode);
  await expectWaitingRoom(hostPage, sectorCode, 2);
  await expectWaitingRoom(guestPage, sectorCode, 2);
  // Rated is on by default — Auth emulator guests must “verify” before launch.
  await verifyE2eAccount(hostPage);

  return { hostContext, guestContext, hostPage, guestPage, sectorCode };
}

export async function closeLobbyContexts(
  ...contexts: BrowserContext[]
): Promise<void> {
  await Promise.all(contexts.map((context) => context.close()));
}
