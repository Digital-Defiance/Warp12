import { test } from '@playwright/test';

import {
  closeLobbyContexts,
  expectBridgeTable,
  launchMission,
  setupTwoCaptainLobby,
} from './helpers/online-lobby.js';

test.describe('online mission (Firebase emulators)', () => {
  test('host launches and both captains reach the bridge table', async ({
    browser,
  }) => {
    const { hostContext, guestContext, hostPage, guestPage, sectorCode } =
      await setupTwoCaptainLobby(browser);

    try {
      await launchMission(hostPage);
      await expectBridgeTable(hostPage, sectorCode, 'Captain Pike');
      await expectBridgeTable(guestPage, sectorCode, 'Captain Kirk');
    } finally {
      await closeLobbyContexts(hostContext, guestContext);
    }
  });
});
