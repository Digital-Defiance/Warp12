import type { Page } from '@playwright/test';

export type E2eWarpFactor = 9 | 12 | 15 | 18;

/** Pick a Warp factor via the factor landing (full navigation so localStorage sticks). */
export async function selectWarpFactor(
  page: Page,
  factor: E2eWarpFactor
): Promise<void> {
  await page.goto('/factor');
  await page
    .getByRole('button', { name: new RegExp(`Double-${factor}`) })
    .click();
  await page.waitForURL('/');
}
