import { useEffect } from 'react';

import { ManualViewer } from './manual-viewer';
import styles from './rules-view.module.scss';

interface RulesDialogProps {
  open: boolean;
  onClose: () => void;
}

export function RulesDialog({ open, onClose }: RulesDialogProps) {
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
      aria-labelledby="warp12-rules-dialog-title"
      onClick={onClose}
    >
      <div
        className={styles.dialogPanel}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-rules-dialog-title" className={styles.dialogTitle}>
            Navigational Operations Manual
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className={styles.dialogBody}>
          <ManualViewer variant="dialog" />
        </div>
      </div>
    </div>
  );
}
