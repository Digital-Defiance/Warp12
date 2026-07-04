import { useState } from 'react';

import {
  isAnonymousUser,
  isVerifiedUser,
  LEADERBOARD_MATCHES_URL,
  upgradeAnonymousToGoogle,
} from '../firebase/auth-actions.js';
import type { User } from 'firebase/auth';
import styles from './lobby.module.scss';

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

  if (isVerifiedUser(user)) {
    return (
      <fieldset className={styles.fieldset}>
        <legend>Account</legend>
        <p className={styles.hint}>
          Signed in as <strong>{user.displayName ?? user.email ?? 'Captain'}</strong>.
          You can check in to officiated matches on the{' '}
          <a href={LEADERBOARD_MATCHES_URL} target="_blank" rel="noreferrer">
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
      const code = (err as { code?: string })?.code;
      const message =
        err instanceof Error ? err.message : 'Could not sign in with Google.';
      setError(code ? `${message} (${code})` : message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend>Rated play</legend>
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
    </fieldset>
  );
}
