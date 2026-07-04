import path from 'node:path';

import { defineConfig, devices } from '@playwright/test';

const workspaceRoot = path.join(import.meta.dirname, '../..');
const baseURL = process.env['BASE_URL'] || 'http://localhost:4300';

/** Playwright config for Firebase Emulator Suite e2e (Auth + Firestore). */
export default defineConfig({
  testDir: './src',
  testMatch: '**/*.firebase.spec.ts',
  outputDir: path.join(
    workspaceRoot,
    'dist/.playwright/Warp12-e2e-firebase/test-output'
  ),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 60_000,
  reporter: [
    [
      'html',
      {
        outputFolder: path.join(
          workspaceRoot,
          'dist/.playwright/Warp12-e2e-firebase/playwright-report'
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
    reuseExistingServer: false,
    cwd: workspaceRoot,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
