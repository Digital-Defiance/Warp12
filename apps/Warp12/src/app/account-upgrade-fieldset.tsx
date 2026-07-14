import { useEffect, useRef, useState } from 'react';

import {
  isAnonymousUser,
  isVerifiedUser,
  LEADERBOARD_MATCHES_URL,
  upgradeAnonymousToGoogle,
} from '../firebase/auth-actions.js';
import {
  appendOauthDiagnostic,
  clearOauthDiagnostics,
  formatOauthDiagnostics,
  readOauthDiagnostics,
} from '../firebase/oauth-diagnostics.js';
import type { User } from 'firebase/auth';
import styles from './lobby.module.scss';

const DIAG_UNLOCK_TAPS = 5;
const DIAG_TAP_WINDOW_MS = 2_500;

export function AccountUpgradeFieldset({
  user,
  onUpgraded,
}: {
  user: User;
  onUpgraded: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [diagUnlocked, setDiagUnlocked] = useState(false);
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagText, setDiagText] = useState(() => formatOauthDiagnostics());
  const tapCountRef = useRef(0);
  const tapResetRef = useRef(0);

  const refreshDiagnostics = () => {
    setDiagText(formatOauthDiagnostics(readOauthDiagnostics()));
  };

  // Live-refresh only when the hidden panel is unlocked and open (or signing in).
  useEffect(() => {
    if (!diagUnlocked || (!busy && !diagOpen)) {
      return;
    }
    refreshDiagnostics();
    const id = window.setInterval(refreshDiagnostics, 1500);
    return () => window.clearInterval(id);
  }, [busy, diagOpen, diagUnlocked]);

  useEffect(() => {
    return () => window.clearTimeout(tapResetRef.current);
  }, []);

  if (isVerifiedUser(user)) {
    return (
      <fieldset className={styles.fieldset}>
        <legend>Account</legend>
        <p className={styles.hint}>
          Signed in as <strong>{user.displayName ?? user.email ?? 'Captain'}</strong>.
          You can check in to officiated matches on the{' '}
          <a
            href={LEADERBOARD_MATCHES_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            leaderboard
          </a>
          .
        </p>
      </fieldset>
    );
  }

  if (!isAnonymousUser(user)) {
    return null;
  }

  const handleLegendActivate = () => {
    window.clearTimeout(tapResetRef.current);
    const next = tapCountRef.current + 1;
    if (next >= DIAG_UNLOCK_TAPS) {
      tapCountRef.current = 0;
      setDiagUnlocked(true);
      setDiagOpen(true);
      refreshDiagnostics();
      return;
    }
    tapCountRef.current = next;
    tapResetRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, DIAG_TAP_WINDOW_MS);
  };

  const handleUpgrade = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { linked } = await upgradeAnonymousToGoogle();
      if (!linked) {
        setNotice(
          'Signed in with your existing Google account. Practice stats from this guest session stay on the guest profile — they do not merge automatically.'
        );
      }
      await onUpgraded();
    } catch (err) {
      console.error('[oauth] sign-in failed', err);
      appendOauthDiagnostic('upgradeAnonymousToGoogle: failed', {
        message: err instanceof Error ? err.message : String(err),
        code:
          err && typeof err === 'object' && 'code' in err
            ? String((err as { code: unknown }).code)
            : undefined,
      });
      const code = (err as { code?: string })?.code;
      const message =
        err instanceof Error ? err.message : 'Could not sign in with Google.';
      setError(code ? `${message} (${code})` : message);
    } finally {
      if (diagUnlocked) {
        refreshDiagnostics();
      }
      setBusy(false);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend
        className={styles.oauthDiagLegend}
        onClick={handleLegendActivate}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleLegendActivate();
          }
        }}
        // Not advertised — 5 quick taps unlocks release diagnostics.
        tabIndex={0}
      >
        Rated play
      </legend>
      <p className={styles.hint}>
        You are on a guest account. Practice vs AI TEI is saved here, but officiated
        human-pool matches require Google sign-in. If this Google account was already
        used on the leaderboard, we sign you into that existing account instead of
        linking the guest profile.
      </p>
      <button
        type="button"
        className={styles.primary}
        disabled={busy}
        onClick={() => void handleUpgrade()}
      >
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {notice && <p className={styles.hint}>{notice}</p>}
      {error && <p className={styles.error}>{error}</p>}

      {diagUnlocked && (
        <details
          className={styles.oauthDiag}
          open={diagOpen}
          onToggle={(event) => {
            const next = (event.currentTarget as HTMLDetailsElement).open;
            setDiagOpen(next);
            if (next) {
              refreshDiagnostics();
            }
          }}
        >
          <summary>Sign-in diagnostics</summary>
          <p className={styles.hint}>
            Step log from the last Google sign-in attempts on this device (no
            tokens). Tap the Rated play label five times to show this panel.
          </p>
          <pre className={styles.oauthDiagLog}>{diagText}</pre>
          <div className={styles.oauthDiagActions}>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => refreshDiagnostics()}
            >
              Refresh
            </button>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => {
                clearOauthDiagnostics();
                refreshDiagnostics();
              }}
            >
              Clear
            </button>
          </div>
        </details>
      )}
    </fieldset>
  );
}
