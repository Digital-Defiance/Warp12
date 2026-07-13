import type { GameState } from 'warp12-engine';
import { TEI_OBJECTIVE_LABEL, getTeiDisplay } from 'warp12-engine';
import {
  coachingMessageForTeiDelta,
  type AdvisorPerformanceSummary,
} from 'warp12-react';

import type { LocalAiMatchReport, OnlineHumanSelfReport } from '../firebase/stats-service.js';
import type { StoredRating } from '../firebase/rating-types.js';
import {
  sectorCompleteHeadline,
  sectorStandings,
  sectorWinnerId,
} from '../game/sector-outcome.js';
import {
  captainPilotIcon,
  DEFAULT_CAPTAIN_GENDER,
} from '../game/captain-profile.js';
import { AdvisorReportDownloadButtons } from './advisor-report-download-buttons';
import { TeiChange } from './components/tei-change.js';
import { useConfettiOnPromotion } from './use-confetti.js';
import dialogStyles from './rules-view.module.scss';
import styles from './bridge-table.module.scss';

function formatRatingChange(
  before: StoredRating | null,
  after: StoredRating | null,
  muDelta: number | null
): string {
  if (!before || !after || muDelta === null) {
    return '—';
  }
  const gradeBefore = before.displayGrade ?? 'P00';
  const gradeAfter = after.displayGrade ?? 'P00';
  
  if (muDelta === 0 || gradeBefore === gradeAfter) {
    return `${gradeBefore} → ${gradeAfter}`;
  }
  const sign = muDelta > 0 ? '+' : '';
  const muChange = muDelta.toFixed(1);
  return `${gradeBefore} → ${gradeAfter} (${sign}${muChange}μ)`;
}

function getRatingGradeChange(
  before: StoredRating | null,
  after: StoredRating | null
): { promoted: boolean; demoted: boolean; message?: string } {
  if (!before || !after) {
    return { promoted: false, demoted: false };
  }
  
  const gradeBefore = before.displayGrade ?? 'P00';
  const gradeAfter = after.displayGrade ?? 'P00';
  
  // Extract grade letter
  const letterBefore = gradeBefore.charAt(0);
  const letterAfter = gradeAfter.charAt(0);
  
  const gradeOrder = ['E', 'V', 'C', 'I', 'P'];
  const indexBefore = gradeOrder.indexOf(letterBefore);
  const indexAfter = gradeOrder.indexOf(letterAfter);
  
  if (indexAfter < indexBefore) {
    // Promoted (E is 0, P is 4, so lower index = better)
    return { promoted: true, demoted: false, message: `📈 Grade promoted: ${letterBefore}→${letterAfter}!` };
  } else if (indexAfter > indexBefore) {
    return { promoted: false, demoted: true };
  } else if (after.mu > before.mu) {
    return { promoted: true, demoted: false, message: '📈 Rating improved!' };
  }
  return { promoted: false, demoted: false };
}

export interface CampaignCompleteOverlayProps {
  open: boolean;
  game: GameState;
  names: Readonly<Record<string, string>>;
  humanId?: string;
  humanName?: string;
  matchReport: LocalAiMatchReport | OnlineHumanSelfReport | null;
  matchReportPending?: boolean;
  matchReportNotice?: string | null;
  ratedMatchCheckInUrl?: string;
  performance: AdvisorPerformanceSummary | null;
  canDownloadAdvisorReport?: boolean;
  onDownloadAdvisorReport?: (includeAllCaptains: boolean) => void;
  pilotIconSrc?: string;
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
  ratedMatchCheckInUrl,
  performance,
  canDownloadAdvisorReport = false,
  onDownloadAdvisorReport,
  pilotIconSrc = captainPilotIcon(DEFAULT_CAPTAIN_GENDER),
  onRematch,
  onLeaveSetup,
  onClose,
}: CampaignCompleteOverlayProps) {
  // Check if any grade was promoted
  const gradeChange = matchReport?.ratingBefore && matchReport?.ratingAfter
    ? getRatingGradeChange(matchReport.ratingBefore, matchReport.ratingAfter)
    : { promoted: false, demoted: false };
  
  const charterGradeChange = matchReport?.charterRatingBefore && matchReport?.charterRatingAfter
    ? getRatingGradeChange(matchReport.charterRatingBefore, matchReport.charterRatingAfter)
    : { promoted: false, demoted: false };
  
  const anyPromotion = gradeChange.promoted || charterGradeChange.promoted;

  // Trigger confetti on grade promotion
  useConfettiOnPromotion(anyPromotion && open);

  if (!open) {
    return null;
  }

  const winnerId = sectorWinnerId(game);
  const humanWon = Boolean(humanId && winnerId === humanId);
  const standings = sectorStandings(game, names);
  const headline = sectorCompleteHeadline(game, names, humanId);
  const eloMessage = matchReport
    ? coachingMessageForTeiDelta(
        matchReport.teiDelta,
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

        <ul className={styles.roundEndPoints}>
          {standings.map((entry, index) => (
            <li
              key={entry.id}
              data-winner={entry.id === winnerId ? 'true' : undefined}
            >
              {index + 1}. {entry.name} — {entry.label}
            </li>
          ))}
        </ul>

        {matchReport?.rated && matchReport.ratingBefore && matchReport.ratingAfter && (
          <>
            {matchReport.charterId &&
            matchReport.charterRatingBefore &&
            matchReport.charterRatingAfter &&
            matchReport.charterRatingBefore.displayRating !== matchReport.ratingBefore.displayRating ? (
              <>
                <div className={styles.roundEndBody}>
                  <strong>Global TEI</strong> ({TEI_OBJECTIVE_LABEL[matchReport.objective]}):
                  <br />
                  <TeiChange
                    beforeRating={{ mu: matchReport.ratingBefore.mu, sigma: matchReport.ratingBefore.sigma, matches: matchReport.ratingBefore.matches }}
                    beforeGrade={matchReport.ratingBefore.displayGrade?.charAt(0) as any}
                    afterRating={{ mu: matchReport.ratingAfter.mu, sigma: matchReport.ratingAfter.sigma, matches: matchReport.ratingAfter.matches }}
                    afterGrade={matchReport.ratingAfter.displayGrade?.charAt(0) as any}
                    showDelta={true}
                    animate={true}
                  />
                </div>
                <div className={styles.roundEndBody}>
                  <strong>Crew TEI:</strong>
                  <br />
                  <TeiChange
                    beforeRating={{ mu: matchReport.charterRatingBefore.mu, sigma: matchReport.charterRatingBefore.sigma, matches: matchReport.charterRatingBefore.matches }}
                    beforeGrade={matchReport.charterRatingBefore.displayGrade?.charAt(0) as any}
                    afterRating={{ mu: matchReport.charterRatingAfter.mu, sigma: matchReport.charterRatingAfter.sigma, matches: matchReport.charterRatingAfter.matches }}
                    afterGrade={matchReport.charterRatingAfter.displayGrade?.charAt(0) as any}
                    showDelta={true}
                    animate={true}
                  />
                </div>
              </>
            ) : (
              <div className={styles.roundEndBody}>
                <strong>{matchReport.charterId ? 'Crew TEI' : 'TEI'}</strong> (
                {TEI_OBJECTIVE_LABEL[matchReport.objective]}):
                <br />
                <TeiChange
                  beforeRating={{ mu: matchReport.ratingBefore.mu, sigma: matchReport.ratingBefore.sigma, matches: matchReport.ratingBefore.matches }}
                  beforeGrade={matchReport.ratingBefore.displayGrade?.charAt(0) as any}
                  afterRating={{ mu: matchReport.ratingAfter.mu, sigma: matchReport.ratingAfter.sigma, matches: matchReport.ratingAfter.matches }}
                  afterGrade={matchReport.ratingAfter.displayGrade?.charAt(0) as any}
                  showDelta={true}
                  animate={true}
                />
              </div>
            )}
          </>
        )}

        {eloMessage && <p className={styles.roundEndBody}>{eloMessage}</p>}

        {matchReportPending && (
          <p className={styles.roundEndBody}>Saving TEI…</p>
        )}

        {!matchReportPending && matchReportNotice && (
          <p className={styles.roundEndBody}>{matchReportNotice}</p>
        )}

        {ratedMatchCheckInUrl && (
          <p className={styles.roundEndBody}>
            Playing an officiated offline event?{' '}
            <a href={ratedMatchCheckInUrl} target="_blank" rel="noreferrer">
              Check in on the leaderboard
            </a>
            {' '}with your match official&apos;s code.
          </p>
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
          <AdvisorReportDownloadButtons
            pilotIconSrc={pilotIconSrc}
            onDownloadYourMoves={() => onDownloadAdvisorReport(false)}
            onDownloadAllCaptains={() => onDownloadAdvisorReport(true)}
          />
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
