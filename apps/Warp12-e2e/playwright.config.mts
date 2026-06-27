import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

// Avoid @nx/playwright/preset here: Playwright loads this file as ESM, which
// breaks Nx's native Module._load hook when the preset pulls in @nx/devkit.
const workspaceRoot = path.join(import.meta.dirname, '../..');
const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

export default defineConfig({
  testDir: './src',
  outputDir: path.join(
    workspaceRoot,
    'dist/.playwright/Warp12-e2e/test-output'
  ),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
  },
  webServer: {
    command: 'yarn preview:bridge',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    cwd: workspaceRoot,
  },
  projects: [
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
  ],
});
