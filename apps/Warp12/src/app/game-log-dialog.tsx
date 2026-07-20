import { useEffect } from 'react';

import type { NameColorEntry } from './game-log-display.js';
import { GameLogLine } from './game-log-line.js';
import type { GameLogScope } from './log-visibility-prefs.js';
import {
  ROUND_LOG_JSON_LABEL,
} from './round-image-actions.js';
import { RoundLogJsonIcon } from './round-image-icons.js';
import dialogStyles from './rules-view.module.scss';
import styles from './game-log-dialog.module.scss';

export const ROUND_LOG_TEXT_LABEL = 'Download round log (text)';
export const HIGHLIGHTS_TEXT_LABEL = 'Download highlights (text)';

const SCOPE_OPTIONS: readonly {
  readonly id: GameLogScope;
  readonly label: string;
}[] = [
  { id: 'all', label: 'All captains' },
  { id: 'mine', label: 'Yourself' },
  { id: 'commentator', label: 'Commentator' },
];

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
  scope?: GameLogScope;
  onScopeChange?: (scope: GameLogScope) => void;
  onDownloadHighlights?: () => void;
  onOpenStreamOverlay?: () => void;
  onOpenStreamSetup?: () => void;
  streamOverlayUrl?: string;
  /** Multiplier for log line font size (1 = default). */
  fontScale?: number;
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
  scope = 'all',
  onScopeChange,
  onDownloadHighlights,
  onOpenStreamOverlay,
  onOpenStreamSetup,
  streamOverlayUrl,
  fontScale = 1,
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

  const emptyHint =
    scope === 'commentator'
      ? 'No highlights yet this round — big beats will land here.'
      : 'No log entries for this round.';

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

        {onScopeChange ? (
          <div
            className={styles.scopeTabs}
            role="tablist"
            aria-label="Log scope"
          >
            {SCOPE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={scope === option.id}
                className={styles.scopeTab}
                data-active={scope === option.id ? 'true' : 'false'}
                onClick={() => onScopeChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}

        <div
          className={styles.logBody}
          style={{ ['--log-font-scale' as string]: String(fontScale) }}
        >
          {lines.length === 0 ? (
            <p className={styles.line}>{emptyHint}</p>
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
            {scope === 'commentator'
              ? 'Highlights for streaming — download text, or open the OBS overlay.'
              : 'Review the log, then download a text or JSON copy. On iPad, download opens the share sheet (or copies to the clipboard).'}
            {streamOverlayUrl ? (
              <>
                {' '}
                Overlay:{' '}
                <code className={styles.overlayUrl}>{streamOverlayUrl}</code>
              </>
            ) : null}
          </p>
          <div className={styles.downloadActions}>
            {onOpenStreamSetup ? (
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={onOpenStreamSetup}
                aria-label="Open stream setup"
              >
                Stream setup
              </button>
            ) : null}
            {onOpenStreamOverlay ? (
              <button
                type="button"
                className={styles.downloadBtn}
                onClick={onOpenStreamOverlay}
                aria-label="Open commentary stream overlay"
              >
                Stream overlay
              </button>
            ) : null}
            {onDownloadHighlights && scope !== 'commentator' ? (
              <button
                type="button"
                className={styles.downloadBtn}
                disabled={downloadBusy}
                onClick={onDownloadHighlights}
                aria-label={HIGHLIGHTS_TEXT_LABEL}
              >
                Highlights
              </button>
            ) : null}
            <button
              type="button"
              className={styles.downloadBtn}
              disabled={downloadBusy || lines.length === 0}
              onClick={
                scope === 'commentator' && onDownloadHighlights
                  ? onDownloadHighlights
                  : onDownload
              }
              aria-label={
                scope === 'commentator'
                  ? HIGHLIGHTS_TEXT_LABEL
                  : ROUND_LOG_TEXT_LABEL
              }
              title={`${
                scope === 'commentator'
                  ? HIGHLIGHTS_TEXT_LABEL
                  : ROUND_LOG_TEXT_LABEL
              } — ${downloadFilename}`}
            >
              {downloadBusy ? 'Preparing…' : 'Download text'}
            </button>
            {scope !== 'commentator' ? (
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
            ) : null}
          </div>
        </footer>
      </div>
    </div>
  );
}
