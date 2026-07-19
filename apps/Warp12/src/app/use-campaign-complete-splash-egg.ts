import { useCallback, useRef } from 'react';

import { requestSplashReplay } from './splash-screen.js';

const TRIPLE_WINDOW_MS = 700;
const SPLASH_DELAY_MS = 3000;

/**
 * Triple-click handler: after the third click within {@link TRIPLE_WINDOW_MS},
 * waits {@link SPLASH_DELAY_MS} then replays the splash overlay.
 */
export function useCampaignCompleteSplashEgg(): () => void {
  const stateRef = useRef({ count: 0, resetTimer: 0, splashTimer: 0 });

  return useCallback(() => {
    const state = stateRef.current;
    window.clearTimeout(state.resetTimer);
    state.count += 1;
    if (state.count < 3) {
      state.resetTimer = window.setTimeout(() => {
        state.count = 0;
      }, TRIPLE_WINDOW_MS);
      return;
    }
    state.count = 0;
    window.clearTimeout(state.splashTimer);
    state.splashTimer = window.setTimeout(() => {
      requestSplashReplay();
    }, SPLASH_DELAY_MS);
  }, []);
}
