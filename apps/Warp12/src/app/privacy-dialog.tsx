import { useEffect } from 'react';

import { WARP12_PRIVACY_MARKDOWN } from '../content/privacy-source';
import { RulesMarkdown } from './rules-markdown';
import styles from './rules-view.module.scss';

interface PrivacyDialogProps {
  open: boolean;
  onClose: () => void;
}

export function PrivacyDialog({ open, onClose }: PrivacyDialogProps) {
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
      aria-labelledby="warp12-privacy-dialog-title"
      onClick={onClose}
    >
      <div
        className={styles.dialogPanel}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-privacy-dialog-title" className={styles.dialogTitle}>
            Privacy Policy
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
          <RulesMarkdown source={WARP12_PRIVACY_MARKDOWN} />
        </div>
      </div>
    </div>
  );
}
