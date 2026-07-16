import { useEffect, useState } from 'react';

import type { AdvisorReport } from 'warp12-engine';
import { advisorReportPlainText, formatAdvisorReport } from 'warp12-react';

import { deliverBlob } from '../game/deliver-file.js';
import type { NameColorEntry } from './game-log-display.js';
import { GameLogLine } from './game-log-line.js';
import dialogStyles from './rules-view.module.scss';
import styles from './game-log-dialog.module.scss';

export interface AdvisorReportDialogProps {
  open: boolean;
  onClose: () => void;
  report: AdvisorReport | null;
  names: Readonly<Record<string, string>>;
  nameColors: readonly NameColorEntry[];
  downloadFilename: string;
  includeAllCaptains: boolean;
  onIncludeAllCaptainsChange: (value: boolean) => void;
  opponentLabel?: string;
}

export function AdvisorReportDialog({
  open,
  onClose,
  report,
  names,
  nameColors,
  downloadFilename,
  includeAllCaptains,
  onIncludeAllCaptainsChange,
  opponentLabel,
}: AdvisorReportDialogProps) {
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDownloadStatus(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open || !report) {
    return null;
  }

  const lines = formatAdvisorReport(report, names, { opponentLabel });

  const handleDownload = async () => {
    const text = advisorReportPlainText(report, names, { opponentLabel });
    setDownloadBusy(true);
    setDownloadStatus(null);
    try {
      const result = await deliverBlob({
        blob: new Blob([text], { type: 'text/plain;charset=utf-8' }),
        filename: downloadFilename,
        title: 'Warp 12 · Advisor report',
        text,
      });
      if (result === 'copied') {
        setDownloadStatus('Copied to clipboard');
      } else if (result === 'shared') {
        setDownloadStatus('Opened in the share sheet');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setDownloadStatus(
        err instanceof Error ? err.message : 'Could not export the advisor report'
      );
    } finally {
      setDownloadBusy(false);
    }
  };

  return (
    <div
      className={dialogStyles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-advisor-report-title"
      onClick={onClose}
    >
      <div
        className={`${dialogStyles.dialogPanel} ${styles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={dialogStyles.dialogHeader}>
          <h2 id="warp12-advisor-report-title" className={dialogStyles.dialogTitle}>
            Advisor report
          </h2>
          <button
            type="button"
            className={dialogStyles.dialogClose}
            onClick={onClose}
          >
            Close
          </button>
        </header>

        <label className={styles.hint}>
          <input
            type="checkbox"
            checked={includeAllCaptains}
            onChange={(event) =>
              onIncludeAllCaptainsChange(event.target.checked)
            }
          />{' '}
          Include all captains&apos; charting moves (study rivals and allies, not
          just your lines)
        </label>

        <div className={styles.logBody}>
          {lines.map((line, index) => (
            <GameLogLine
              key={`${index}-${line}`}
              line={line}
              nameColors={nameColors}
            />
          ))}
        </div>

        <footer className={styles.footer}>
          <p className={styles.hint}>
            Move strength is scored against other legal lines at that moment. Your
            TEI uses only your moves; turn on all captains to learn from
            everyone at the table. On iPad, download opens the share sheet (or
            copies to the clipboard).
          </p>
          {downloadStatus && (
            <p className={styles.hint} role="status">
              {downloadStatus}
            </p>
          )}
          <button
            type="button"
            className={styles.downloadBtn}
            disabled={lines.length === 0 || downloadBusy}
            onClick={() => void handleDownload()}
            title={downloadFilename}
          >
            {downloadBusy ? 'Preparing…' : 'Download report'}
          </button>
        </footer>
      </div>
    </div>
  );
}
