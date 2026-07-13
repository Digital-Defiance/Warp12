import { expect, test } from '@playwright/test';

import { selectWarpFactor } from './helpers/warp-factor.js';

test.describe('exhibition Warp factor', () => {
  test('Warp 9 local simulation deals a Double-9 spacedock', async ({
    page,
  }) => {
    await selectWarpFactor(page, 9);

    await page.getByRole('button', { name: /Local simulation/i }).click();
    await expect(
      page.getByRole('heading', { name: 'Local simulation' })
    ).toBeVisible();

    const notice = page.getByRole('status');
    await expect(notice).toContainText(/Exhibition set/i);
    await expect(notice).toContainText(/Warp 9/);
    await expect(notice).toContainText(/heuristics only/i);
    await expect(
      page.getByText(/Fleet size \(2–4 captains\) · Warp 9/)
    ).toBeVisible();

    await page.getByRole('button', { name: 'Launch simulation' }).click();

    const spacedock = page
      .locator('dt', { hasText: 'Spacedock' })
      .locator('xpath=following-sibling::dd[1]');
    await expect(spacedock).toHaveText('Double-9', { timeout: 60_000 });

    await expect(
      page.locator('button[aria-label^="Coordinate"]').first()
    ).toBeVisible({ timeout: 30_000 });
  });
});
