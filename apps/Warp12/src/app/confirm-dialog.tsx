import { useEffect } from 'react';

import styles from './rules-view.module.scss';
import confirmStyles from './confirm-dialog.module.scss';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  titleId: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
  confirmTone?: 'default' | 'danger';
}

export function ConfirmDialog({
  open,
  title,
  titleId,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onClose,
  confirmTone = 'default',
}: ConfirmDialogProps) {
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
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div
        className={`${styles.dialogPanel} ${confirmStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id={titleId} className={styles.dialogTitle}>
            {title}
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
          <p className={confirmStyles.message}>{message}</p>
          <div className={confirmStyles.actions}>
            <button
              type="button"
              className={confirmStyles.cancelBtn}
              onClick={onClose}
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              className={confirmStyles.confirmBtn}
              data-tone={confirmTone}
              onClick={onConfirm}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
