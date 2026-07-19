import { useEffect, type FC } from 'react';

import { isTauriRuntime } from '../firebase/platform.js';
import { SplashLogo } from './splash-logo';
import styles from './splash-screen.module.scss';

const SPLASH_MS = 4200;
const SPLASH_SEEN_KEY = 'warp12-splash-seen';
export const SPLASH_REPLAY_EVENT = 'warp12-splash-replay';

export function shouldShowNativeSplash(): boolean {
  if (!isTauriRuntime()) {
    return false;
  }
  try {
    return sessionStorage.getItem(SPLASH_SEEN_KEY) !== '1';
  } catch {
    return true;
  }
}

function markSplashSeen(): void {
  try {
    sessionStorage.setItem(SPLASH_SEEN_KEY, '1');
  } catch {
    /* private mode / blocked storage */
  }
}

/** Force the splash overlay again (easter eggs / replay). Works on web too. */
export function requestSplashReplay(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(SPLASH_REPLAY_EVENT));
}


/** Faces used by the splash mark (registered in styles.scss). */
async function waitForSplashFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) {
    return;
  }
  try {
    await Promise.all([
      document.fonts.load('normal 43px FederationWide'),
      document.fonts.load('100 25px "Nova Light"'),
    ]);
  } catch {
    /* fall through with system fallbacks */
  }
}

export interface SplashScreenProps {
  onFinished: () => void;
  durationMs?: number;
}

/**
 * Tauri splash using the Warp-tx mark, inlined so app @font-face applies.
 * (An &lt;img src="*.svg"&gt; cannot see page fonts.)
 */
export const SplashScreen: FC<SplashScreenProps> = ({
  onFinished,
  durationMs = SPLASH_MS,
}) => {
  useEffect(() => {
    let cancelled = false;
    let timer = 0;

    void (async () => {
      await waitForSplashFonts();
      if (cancelled) {
        return;
      }
      timer = window.setTimeout(() => {
        markSplashSeen();
        onFinished();
      }, durationMs);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [durationMs, onFinished]);

  return (
    <div
      className={styles.splashScreen}
      role="status"
      aria-live="polite"
      aria-label="Warp loading"
    >
      <div className={styles.logoContainer}>
        <SplashLogo className={styles.logo} />
      </div>
    </div>
  );
};
