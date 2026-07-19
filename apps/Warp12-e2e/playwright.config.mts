import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Avoid @nx/playwright/preset here: Playwright loads this file as ESM, which
// breaks Nx's native Module._load hook when the preset pulls in @nx/devkit.
const workspaceRoot = path.join(import.meta.dirname, '../..');
const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

/** Chromium by default; set PLAYWRIGHT_ALL_BROWSERS=1 for Firefox + WebKit too. */
const allBrowsers = process.env.PLAYWRIGHT_ALL_BROWSERS === '1';

export default defineConfig({
  testDir: './src',
  testIgnore: '**/*.firebase.spec.ts',
  outputDir: path.join(
    workspaceRoot,
    'dist/.playwright/Warp12-e2e/test-output'
  ),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    [
      'html',
      {
        outputFolder: path.join(
          workspaceRoot,
          'dist/.playwright/Warp12-e2e/playwright-report'
        ),
        open: 'on-failure',
      },
    ],
  ],
  use: {
    baseURL,
    trace: 'on-first-retry',
    actionTimeout: 15_000,
  },
  webServer: {
    command: 'yarn preview:bridge',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
  projects: allBrowsers
    ? [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
        {
          name: 'firefox',
          use: { ...devices['Desktop Firefox'] },
        },
        {
          name: 'webkit',
          use: { ...devices['Desktop Safari'] },
        },
      ]
    : [
        {
          name: 'chromium',
          use: { ...devices['Desktop Chrome'] },
        },
      ],
});
