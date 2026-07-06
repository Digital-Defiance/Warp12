import { useEffect } from 'react';

import type { NameColorEntry } from './game-log-display.js';
import { GameLogLine } from './game-log-line.js';
import {
  ROUND_LOG_JSON_LABEL,
} from './round-image-actions.js';
import { RoundLogJsonIcon } from './round-image-icons.js';
import dialogStyles from './rules-view.module.scss';
import styles from './game-log-dialog.module.scss';

export const ROUND_LOG_TEXT_LABEL = 'Download round log (text)';

export interface GameLogDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  lines: readonly string[];
  nameColors: readonly NameColorEntry[];
  downloadFilename: string;
  downloadJsonFilename: string;
  onDownload: () => void;
  onDownloadJson: () => void;
  downloadBusy?: boolean;
}

export function GameLogDialog({
  open,
  onClose,
  title,
  lines,
  nameColors,
  downloadFilename,
  downloadJsonFilename,
  onDownload,
  onDownloadJson,
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
          <p className={styles.hint}>
            Review the log, then download a text or JSON copy.
          </p>
          <div className={styles.downloadActions}>
            <button
              type="button"
              className={styles.downloadBtn}
              disabled={downloadBusy || lines.length === 0}
              onClick={onDownload}
              aria-label={ROUND_LOG_TEXT_LABEL}
              title={`${ROUND_LOG_TEXT_LABEL} — ${downloadFilename}`}
            >
              {downloadBusy ? 'Preparing…' : 'Download text'}
            </button>
            <button
              type="button"
              className={styles.downloadJsonBtn}
              disabled={downloadBusy || lines.length === 0}
              onClick={onDownloadJson}
              aria-label={ROUND_LOG_JSON_LABEL}
              title={`${ROUND_LOG_JSON_LABEL} — ${downloadJsonFilename}`}
            >
              <RoundLogJsonIcon />
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
