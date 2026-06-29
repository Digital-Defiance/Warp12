import { useEffect } from 'react';

import styles from './rules-view.module.scss';
import confirmStyles from './confirm-dialog.module.scss';
import dialogStyles from './host-leave-sector-dialog.module.scss';

export interface HostLeaveSectorDialogProps {
  open: boolean;
  onClose: () => void;
  onReturnToWaitingRoom: () => void;
  onDissolveSector: () => void;
}

export function HostLeaveSectorDialog({
  open,
  onClose,
  onReturnToWaitingRoom,
  onDissolveSector,
}: HostLeaveSectorDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-host-leave-title"
      onClick={onClose}
    >
      <div
        className={`${styles.dialogPanel} ${confirmStyles.panel} ${dialogStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-host-leave-title" className={styles.dialogTitle}>
            Leave bridge?
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className={`${styles.dialogBody} ${confirmStyles.body}`}>
          <p className={confirmStyles.message}>
            As host, choose how to end this mission. Returning to the waiting
            room keeps the sector code and crew so you can launch again. Dissolving
            the sector removes everyone and the code will stop working.
          </p>
          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={confirmStyles.cancelBtn}
              onClick={onClose}
            >
              Keep playing
            </button>
            <button
              type="button"
              className={confirmStyles.confirmBtn}
              onClick={onReturnToWaitingRoom}
            >
              Return to waiting room
            </button>
            <button
              type="button"
              className={confirmStyles.confirmBtn}
              data-tone="danger"
              onClick={onDissolveSector}
            >
              Dissolve sector
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
