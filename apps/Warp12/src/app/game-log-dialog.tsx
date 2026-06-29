import { useEffect } from 'react';

import type { NameColorEntry } from './game-log-display.js';
import { GameLogLine } from './game-log-line.js';
import dialogStyles from './rules-view.module.scss';
import styles from './game-log-dialog.module.scss';

export interface GameLogDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: readonly string[];
  nameColors: readonly NameColorEntry[];
  downloadFilename: string;
  onDownload: () => void;
  downloadBusy?: boolean;
}

export function GameLogDialog({
  open,
  onClose,
  title,
  lines,
  nameColors,
  downloadFilename,
  onDownload,
  downloadBusy = false,
}: GameLogDialogProps) {
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
      className={dialogStyles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-game-log-title"
      onClick={onClose}
    >
      <div
        className={`${dialogStyles.dialogPanel} ${styles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={dialogStyles.dialogHeader}>
          <h2 id="warp12-game-log-title" className={dialogStyles.dialogTitle}>
            {title}
          </h2>
          <button
            type="button"
            className={dialogStyles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <div className={styles.logBody}>
          {lines.length === 0 ? (
            <p className={styles.line}>No log entries for this round.</p>
          ) : (
            lines.map((line, index) => (
              <GameLogLine
                key={`${index}-${line}`}
                line={line}
                nameColors={nameColors}
              />
            ))
          )}
        </div>

        <footer className={styles.footer}>
          <p className={styles.hint}>Review the log, then download if you want a copy.</p>
          <button
            type="button"
            className={styles.downloadBtn}
            disabled={downloadBusy || lines.length === 0}
            onClick={onDownload}
            title={downloadFilename}
          >
            {downloadBusy ? 'Preparing…' : 'Download log'}
          </button>
        </footer>
      </div>
    </div>
  );
}
