import { useCallback, useRef, type MouseEventHandler } from 'react';

import { requestSplashReplay } from './splash-screen.js';

const TRIPLE_WINDOW_MS = 700;
const SPLASH_DELAY_MS = 3000;

/**
 * Triple-activate handler for the campaign/sector-complete label.
 * After the third activation within {@link TRIPLE_WINDOW_MS}, waits
 * {@link SPLASH_DELAY_MS} then replays the splash until the captain clicks.
 * Uses a button (not selectable text) so video takes don't grab a selection.
 */
export function useCampaignCompleteSplashEgg(): MouseEventHandler<HTMLButtonElement> {
  const stateRef = useRef({ count: 0, resetTimer: 0, splashTimer: 0 });

  return useCallback((event) => {
    event.preventDefault();
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
      requestSplashReplay({ dismiss: 'click' });
    }, SPLASH_DELAY_MS);
  }, []);
}
