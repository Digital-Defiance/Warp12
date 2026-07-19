import { useEffect } from 'react';

import styles from './rules-view.module.scss';
import confirmStyles from './confirm-dialog.module.scss';
import dialogStyles from './host-leave-sector-dialog.module.scss';

export interface HostMissingCaptainDialogProps {
  open: boolean;
  captainName: string;
  onClose: () => void;
  onPause: () => void;
  onDropSeat: () => void;
  onAbortSector: () => void;
  busy?: boolean;
}

/**
 * Host prompt when a seated human goes silent mid-mission.
 * Pause keeps the seat; drop removes them via Cloud Function; abort dissolves.
 */
export function HostMissingCaptainDialog({
  open,
  captainName,
  onClose,
  onPause,
  onDropSeat,
  onAbortSector,
  busy = false,
}: HostMissingCaptainDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-missing-captain-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className={`${styles.dialogPanel} ${confirmStyles.panel} ${dialogStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-missing-captain-title" className={styles.dialogTitle}>
            Captain offline
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </header>
        <div className={`${styles.dialogBody} ${confirmStyles.body}`}>
          <p className={confirmStyles.message}>
            <strong>{captainName}</strong> has dropped out of subspace. Choose
            how to continue the mission.
          </p>
          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={confirmStyles.cancelBtn}
              onClick={onClose}
              disabled={busy}
            >
              Keep waiting
            </button>
            <button
              type="button"
              className={confirmStyles.confirmBtn}
              onClick={onPause}
              disabled={busy}
            >
              Pause sector
            </button>
            <button
              type="button"
              className={confirmStyles.confirmBtn}
              onClick={onDropSeat}
              disabled={busy}
            >
              Drop seat &amp; continue
            </button>
            <button
              type="button"
              className={confirmStyles.confirmBtn}
              data-tone="danger"
              onClick={onAbortSector}
              disabled={busy}
            >
              Abort sector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
