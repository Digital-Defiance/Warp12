import { expect, test } from '@playwright/test';

/**
 * Local + pass-and-play setup smokes for go-out campaigns and starter pick.
 * Does not play a full multi-round campaign (too slow); verifies the setup
 * path reaches an active bridge with the chosen structure.
 */
test.describe('go-out campaign setup (local / pass-and-play)', () => {
  test('local simulation: first-to go-out + AI starter launches', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/local');
    await expect(
      page.getByRole('heading', { name: 'Local simulation' })
    ).toBeVisible();

    await page.locator('input[type="radio"][value="go-out"]').check();
    await expect(
      page.getByRole('group', { name: 'Go-out sector structure' })
    ).toBeVisible();

    await page.locator('input[type="radio"][value="first-to"]').check();
    await page.getByLabel('Wins to win').selectOption('2');

    const starter = page.getByLabel('First-round starter');
    await expect(starter).toBeVisible();
    const options = starter.locator('option');
    const optionCount = await options.count();
    expect(optionCount).toBeGreaterThan(1);
    await starter.selectOption({ index: Math.min(2, optionCount - 1) });

    await page.getByRole('button', { name: 'Launch simulation' }).click();

    await expect(
      page
        .locator('dt', { hasText: 'Spacedock' })
        .locator('xpath=following-sibling::dd[1]')
    ).toHaveText(/Double-12/, { timeout: 45_000 });
    await expect(
      page.locator('button[aria-label^="Coordinate"]').first()
    ).toBeVisible({ timeout: 20_000 });
  });

  test('pass-and-play: fixed-rounds go-out reaches the bridge', async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.goto('/local/pass-and-play');
    await expect(
      page.getByRole('heading', { name: /Pass.?and.?play/i })
    ).toBeVisible();

    await page.locator('input[type="radio"][value="go-out"]').check();
    await page.locator('input[type="radio"][value="fixed-rounds"]').check();
    await expect(page.getByText('Tie-break overtime')).toBeVisible();
    await page.locator('input[type="radio"][value="force"]').check();

    await page.getByRole('button', { name: 'Launch table' }).click();

    await expect(
      page
        .locator('dt', { hasText: 'Spacedock' })
        .locator('xpath=following-sibling::dd[1]')
    ).toHaveText(/Double-12/, { timeout: 45_000 });
  });
});
