import { expect, test, type Page } from '@playwright/test';

/**
 * Couch mode: Bridge publishes per-seat hands; a locked companion window
 * can chart for that seat over BroadcastChannel (same browser context).
 */
async function launchPassAndPlay(page: Page): Promise<void> {
  await page.goto('/local/pass-and-play');
  await expect(
    page.getByRole('heading', { name: /Pass.?and.?play/i })
  ).toBeVisible();

  await page.getByLabel('Fleet size').selectOption('2');
  await page.getByLabel('AI officers').selectOption('0');

  await page.getByRole('button', { name: 'Launch table' }).click();
  await expect(
    page
      .locator('dt', { hasText: 'Spacedock' })
      .locator('xpath=following-sibling::dd[1]')
  ).toHaveText(/Double-12/, { timeout: 45_000 });
}

async function activeHelmName(page: Page): Promise<string> {
  const helm = page
    .locator('dt', { hasText: 'Helm' })
    .locator('xpath=following-sibling::dd[1]');
  return ((await helm.textContent()) ?? '').trim();
}

async function unchartedCount(page: Page): Promise<number> {
  const value = page
    .locator('dt', { hasText: 'Uncharted' })
    .locator('xpath=following-sibling::dd[1]');
  return Number(((await value.textContent()) ?? '').trim());
}

async function openStreamSetup(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Open sector log' }).click();
  await page.getByRole('button', { name: 'Open stream setup' }).click();
  await expect(
    page.getByRole('heading', { name: 'Stream setup' })
  ).toBeVisible();
}

async function dismissOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
  }
}

async function chartFromCompanionViaChannel(
  hand: Page,
  seatId: string
): Promise<void> {
  await expect(
    hand.locator('button[data-playable="true"]').first()
  ).toBeVisible({ timeout: 30_000 });

  await hand.evaluate((id) => {
    const btn = document.querySelector(
      'button[data-playable="true"]'
    ) as HTMLElement | null;
    const label = btn?.getAttribute('aria-label') ?? '';
    const match = /Coordinate (\d+)-(\d+)/.exec(label);
    if (!match) {
      throw new Error(`No playable tile label: ${label}`);
    }
    const a = Number(match[1]);
    const b = Number(match[2]);
    const coordinate = { low: Math.min(a, b), high: Math.max(a, b) };
    const routes = [
      { kind: 'neutral-zone' as const },
      { kind: 'warp-trail' as const, playerId: id },
    ];
    const channel = new BroadcastChannel(`warp12-hand-companion-v1:${id}`);
    for (const route of routes) {
      channel.postMessage({
        type: 'action',
        action: {
          type: 'CHART_COORDINATE',
          playerId: id,
          coordinate,
          route,
        },
      });
    }
    channel.close();
  }, seatId);
}

test.describe('couch mode hand companion', () => {
  test('seat companion syncs and can chart a coordinate', async ({
    browser,
  }) => {
    test.setTimeout(120_000);

    const context = await browser.newContext();
    const bridge = await context.newPage();
    await launchPassAndPlay(bridge);

    const ready = bridge.getByRole('button', { name: 'Ready at helm' });
    if (await ready.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ready.click();
    }

    const helmBefore = await activeHelmName(bridge);
    const unchartedBefore = await unchartedCount(bridge);
    const seatId = helmBefore === 'Lovell' ? 'human:1' : 'human:0';
    const seatName = helmBefore === 'Lovell' ? 'Lovell' : 'Armstrong';

    await openStreamSetup(bridge);

    // Enable couch mode opens one window per seat via window.open.
    const existing = new Set(context.pages());
    await bridge.getByRole('button', { name: 'Enable couch mode' }).click();
    await expect
      .poll(() => context.pages().length, { timeout: 15_000 })
      .toBeGreaterThan(existing.size);

    await dismissOverlays(bridge);

    const hand =
      context
        .pages()
        .find(
          (page) =>
            !existing.has(page) &&
            page.url().includes(`/local/hand/${encodeURIComponent(seatId)}`)
        ) ??
      context.pages().find((page) => page.url().includes('/local/hand/'));

    expect(hand).toBeTruthy();
    if (!hand) {
      await context.close();
      return;
    }

    await hand.bringToFront();
    await expect(hand.getByText(new RegExp(`${seatName} ·`, 'i'))).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      hand.getByRole('list', { name: /coordinates in hand/i })
    ).toBeVisible({ timeout: 20_000 });

    if (!(await hand.getByText(/Your turn/i).isVisible().catch(() => false))) {
      await hand.goto(`/local/hand/${encodeURIComponent(seatId)}`);
      await expect(hand.getByText(/Your turn/i)).toBeVisible({
        timeout: 20_000,
      });
    }

    await chartFromCompanionViaChannel(hand, seatId);

    // Enable couch switches the HUD log to commentator (routine charts are
    // filtered). Assert on public table state instead.
    await expect
      .poll(
        async () => {
          const helm = await activeHelmName(bridge);
          const uncharted = await unchartedCount(bridge);
          return helm !== helmBefore || uncharted !== unchartedBefore;
        },
        { timeout: 25_000 }
      )
      .toBe(true);

    await context.close();
  });

  test('stream setup exposes couch mode for pass-and-play', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await launchPassAndPlay(page);
    await openStreamSetup(page);
    await expect(
      page.getByRole('button', { name: 'Enable couch mode' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open seat hands' })
    ).toBeVisible();
    await expect(page.getByText('Couch seat URLs')).toBeVisible();
  });
});
