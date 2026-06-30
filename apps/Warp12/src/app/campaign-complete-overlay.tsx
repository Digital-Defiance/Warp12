import type { GameState } from 'warp12-engine';
import {
  coachingMessageForEloDelta,
  type AdvisorPerformanceSummary,
} from 'warp12-react';

import type { LocalAiMatchReport } from '../firebase/stats-service.js';
import {
  sectorCompleteHeadline,
  sectorStandings,
  sectorWinnerId,
} from '../game/sector-outcome.js';
import dialogStyles from './rules-view.module.scss';
import styles from './bridge-table.module.scss';

export interface CampaignCompleteOverlayProps {
  open: boolean;
  game: GameState;
  names: Readonly<Record<string, string>>;
  humanId?: string;
  humanName?: string;
  matchReport: LocalAiMatchReport | null;
  matchReportPending?: boolean;
  matchReportNotice?: string | null;
  performance: AdvisorPerformanceSummary | null;
  canDownloadAdvisorReport?: boolean;
  onDownloadAdvisorReport?: (includeAllCaptains: boolean) => void;
  onRematch?: () => void;
  onLeaveSetup?: () => void;
  onClose: () => void;
}

export function CampaignCompleteOverlay({
  open,
  game,
  names,
  humanId,
  humanName,
  matchReport,
  matchReportPending = false,
  matchReportNotice = null,
  performance,
  canDownloadAdvisorReport = false,
  onDownloadAdvisorReport,
  onRematch,
  onLeaveSetup,
  onClose,
}: CampaignCompleteOverlayProps) {
  if (!open) {
    return null;
  }

  const winnerId = sectorWinnerId(game);
  const humanWon = Boolean(humanId && winnerId === humanId);
  const standings = sectorStandings(game, names);
  const headline = sectorCompleteHeadline(game, names, humanId);
  const eloMessage = matchReport
    ? coachingMessageForEloDelta(
        matchReport.eloDelta,
        matchReport.rated,
        matchReport.won
      )
    : null;

  return (
    <div
      className={styles.roundEndOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-campaign-complete-title"
    >
      <div className={styles.roundEndCard}>
        <p className={styles.roundEndEyebrow}>
          {game.objective === 'go-out' ? 'Sector complete' : 'Campaign complete'}
        </p>
        <h3 id="warp12-campaign-complete-title" className={styles.roundEndTitle}>
          {humanWon && humanName ? `${humanName} wins!` : `${names[winnerId ?? ''] ?? 'Captain'} wins`}
        </h3>
        <p className={styles.roundEndBody}>{headline}</p>

        <ul className={styles.roundEndPenalties}>
          {standings.map((entry, index) => (
            <li
              key={entry.id}
              data-winner={entry.id === winnerId ? 'true' : undefined}
            >
              {index + 1}. {entry.name} — {entry.label}
            </li>
          ))}
        </ul>

        {matchReport?.rated && matchReport.eloBefore !== null && matchReport.eloAfter !== null && (
          <p className={styles.roundEndBody}>
            Solo rating ({matchReport.objective === 'go-out' ? 'go-out' : 'penalty'}):{' '}
            <strong>
              {matchReport.eloBefore} → {matchReport.eloAfter}
            </strong>
            {matchReport.eloDelta !== null && matchReport.eloDelta !== 0 && (
              <span>
                {' '}
                ({matchReport.eloDelta > 0 ? '+' : ''}
                {matchReport.eloDelta})
              </span>
            )}
          </p>
        )}

        {eloMessage && <p className={styles.roundEndBody}>{eloMessage}</p>}

        {matchReportPending && (
          <p className={styles.roundEndBody}>Saving solo rating…</p>
        )}

        {!matchReportPending && matchReportNotice && (
          <p className={styles.roundEndBody}>{matchReportNotice}</p>
        )}

        {performance && (
          <div className={styles.roundEndBody}>
            <p>
              <strong>Your decision quality:</strong> {performance.headline}
            </p>
            <p>{performance.coachingNote}</p>
            <p>
              {performance.strong} strong · {performance.reasonable} solid ·{' '}
              {performance.weak} suboptimal · {performance.blunder} blunder
              {performance.blunder === 1 ? '' : 's'}
            </p>
          </div>
        )}

        {canDownloadAdvisorReport && onDownloadAdvisorReport && (
          <div className={styles.roundEndActions}>
            <button
              type="button"
              className={styles.roundEndBtnSecondary}
              onClick={() => onDownloadAdvisorReport(false)}
            >
              Download your advisor report
            </button>
            <button
              type="button"
              className={styles.roundEndBtnSecondary}
              onClick={() => onDownloadAdvisorReport(true)}
            >
              Download all captains
            </button>
          </div>
        )}

        <div className={styles.roundEndActions}>
          {onRematch && (
            <button type="button" className={styles.roundEndBtn} onClick={onRematch}>
              Rematch
            </button>
          )}
          {onLeaveSetup && (
            <button
              type="button"
              className={styles.roundEndBtnSecondary}
              onClick={onLeaveSetup}
            >
              New setup
            </button>
          )}
          <button
            type="button"
            className={`${dialogStyles.dialogClose} ${styles.roundEndBtnSecondary}`}
            onClick={onClose}
          >
            View board
          </button>
        </div>
      </div>
    </div>
  );
}
