import { useEffect, useRef, type FC, type KeyboardEvent } from 'react';

import { isTauriRuntime } from '../firebase/platform.js';
import { SplashLogo } from './splash-logo';
import styles from './splash-screen.module.scss';

const SPLASH_MS = 4200;
const SPLASH_SEEN_KEY = 'warp12-splash-seen';
export const SPLASH_REPLAY_EVENT = 'warp12-splash-replay';

export type SplashDismissMode = 'timer' | 'click';

export type SplashReplayDetail = {
  dismiss?: SplashDismissMode;
};

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
export function requestSplashReplay(options?: SplashReplayDetail): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<SplashReplayDetail>(SPLASH_REPLAY_EVENT, {
      detail: { dismiss: options?.dismiss ?? 'click' },
    })
  );
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
  /** Boot: auto-dismiss after duration. Egg replay: stay until click/key. */
  dismissMode?: SplashDismissMode;
}

/**
 * Tauri splash using the Warp-tx mark, inlined so app @font-face applies.
 * (An &lt;img src="*.svg"&gt; cannot see page fonts.)
 */
export const SplashScreen: FC<SplashScreenProps> = ({
  onFinished,
  durationMs = SPLASH_MS,
  dismissMode = 'timer',
}) => {
  const finishedRef = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const finish = () => {
    if (finishedRef.current) {
      return;
    }
    finishedRef.current = true;
    markSplashSeen();
    onFinished();
  };

  useEffect(() => {
    finishedRef.current = false;
    if (dismissMode !== 'timer') {
      return;
    }
    let cancelled = false;
    let timer = 0;

    void (async () => {
      await waitForSplashFonts();
      if (cancelled) {
        return;
      }
      timer = window.setTimeout(() => {
        if (finishedRef.current) {
          return;
        }
        finishedRef.current = true;
        markSplashSeen();
        onFinished();
      }, durationMs);
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [durationMs, dismissMode, onFinished]);

  useEffect(() => {
    if (dismissMode !== 'click') {
      return;
    }
    void waitForSplashFonts();
    rootRef.current?.focus();
  }, [dismissMode]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (dismissMode !== 'click') {
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') {
      e.preventDefault();
      finish();
    }
  };

  const clickToDismiss = dismissMode === 'click';

  return (
    <div
      ref={rootRef}
      className={`${styles.splashScreen}${clickToDismiss ? ` ${styles.splashScreenClickable}` : ''}`}
      role={clickToDismiss ? 'button' : 'status'}
      tabIndex={clickToDismiss ? 0 : undefined}
      aria-live={clickToDismiss ? undefined : 'polite'}
      aria-label={
        clickToDismiss
          ? 'Warp logo. Click or press Enter to continue.'
          : 'Warp loading'
      }
      onClick={clickToDismiss ? () => finish() : undefined}
      onKeyDown={clickToDismiss ? onKeyDown : undefined}
    >
      <div className={styles.logoContainer}>
        <SplashLogo className={styles.logo} />
      </div>
      {clickToDismiss ? (
        <p className={styles.dismissHint}>Click to continue</p>
      ) : null}
    </div>
  );
};
