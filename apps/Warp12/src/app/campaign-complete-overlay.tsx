import { Fragment, useState } from 'react';
import type { GameState } from 'warp12-engine';
import { TEI_OBJECTIVE_LABEL } from 'warp12-engine';
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
import type { CampaignRoundPoints } from './campaign-points-history.js';

export type { CampaignRoundPoints };

function formatSignedPoints(points: number): string {
  return `${points < 0 ? '−' : '+'}${Math.abs(points)}`;
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
  /** Per-round campaign point deltas (points objective) for the by-round breakdown. */
  pointsHistory?: readonly CampaignRoundPoints[];
  performance: AdvisorPerformanceSummary | null;
  canDownloadAdvisorReport?: boolean;
  onDownloadAdvisorReport?: (
    includeAllCaptains: boolean
  ) => void | Promise<void>;
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
  pointsHistory,
  performance,
  canDownloadAdvisorReport = false,
  onDownloadAdvisorReport,
  pilotIconSrc = captainPilotIcon(DEFAULT_CAPTAIN_GENDER),
  onRematch,
  onLeaveSetup,
  onClose,
}: CampaignCompleteOverlayProps) {
  // Online sectors carry charter/squad ratings; local AI reports do not. Narrow
  // once so charter fields are only read off the online report shape.
  const onlineReport =
    matchReport && 'humanPool' in matchReport ? matchReport : null;
  const charter =
    onlineReport?.charterId &&
    onlineReport.charterRatingBefore &&
    onlineReport.charterRatingAfter
      ? {
          id: onlineReport.charterId,
          before: onlineReport.charterRatingBefore,
          after: onlineReport.charterRatingAfter,
        }
      : null;
  // Check if any grade was promoted
  const gradeChange = matchReport?.ratingBefore && matchReport?.ratingAfter
    ? getRatingGradeChange(matchReport.ratingBefore, matchReport.ratingAfter)
    : { promoted: false, demoted: false };

  const charterGradeChange = charter
    ? getRatingGradeChange(charter.before, charter.after)
    : { promoted: false, demoted: false };
  
  const anyPromotion = gradeChange.promoted || charterGradeChange.promoted;

  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Trigger confetti on grade promotion
  useConfettiOnPromotion(anyPromotion && open);

  if (!open) {
    return null;
  }

  const winnerId = sectorWinnerId(game);
  const humanWon = Boolean(humanId && winnerId === humanId);
  const standings = sectorStandings(game, names);
  const headline = sectorCompleteHeadline(game, names, humanId);

  // Per-captain by-round point deltas for the click-to-expand breakdown.
  const byCaptainRounds = new Map<
    string,
    { roundNumber: number; points: number }[]
  >();
  for (const round of pointsHistory ?? []) {
    for (const [id, points] of Object.entries(round.deltas)) {
      const list = byCaptainRounds.get(id) ?? [];
      list.push({ roundNumber: round.roundNumber, points });
      byCaptainRounds.set(id, list);
    }
  }
  for (const list of byCaptainRounds.values()) {
    list.sort((a, b) => a.roundNumber - b.roundNumber);
  }
  const canExpandStandings =
    game.objective !== 'go-out' && byCaptainRounds.size > 0;
  const eloMessage = matchReport
    ? coachingMessageForTeiDelta(
        matchReport.teiDelta ?? null,
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

        <table className={styles.roundEndTable}>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col" className={styles.roundEndCaptain}>
                Captain
              </th>
              <th scope="col">
                {game.objective === 'go-out' ? 'Tiles' : 'Points'}
              </th>
            </tr>
          </thead>
          <tbody>
            {standings.map((entry, index) => {
              const isWinner = entry.id === winnerId;
              const rounds = byCaptainRounds.get(entry.id);
              const expandable =
                canExpandStandings && rounds != null && rounds.length > 0;
              const isExpanded = expandedId === entry.id;
              const detailId = `campaign-breakdown-${entry.id}`;
              // Standings sort on the raw value (so a negative Longest Trail
              // tiebreak edges a 0), but the lowest number shown is zero.
              const shownPoints = Math.max(0, entry.value);
              return (
                <Fragment key={entry.id}>
                  <tr data-winner={isWinner ? 'true' : undefined}>
                    <td className={styles.roundEndRank}>
                      {isWinner ? (
                        <span aria-label="Winner" title="Winner">
                          🏆
                        </span>
                      ) : (
                        index + 1
                      )}
                    </td>
                    <td className={styles.roundEndCaptain}>{entry.name}</td>
                    <td
                      className={styles.roundEndPointsCell}
                      title={entry.label}
                    >
                      {expandable ? (
                        <button
                          type="button"
                          className={styles.pointsButton}
                          aria-expanded={isExpanded}
                          aria-controls={detailId}
                          onClick={() =>
                            setExpandedId(isExpanded ? null : entry.id)
                          }
                          title="Show points by round"
                        >
                          <span>{shownPoints}</span>
                          <span className={styles.pointsCaret} aria-hidden>
                            {isExpanded ? '▶️' : '🔽'}
                          </span>
                        </button>
                      ) : (
                        shownPoints
                      )}
                    </td>
                  </tr>
                  {expandable && isExpanded && (
                    <tr className={styles.roundEndDetailRow}>
                      <td colSpan={3} id={detailId}>
                        <div className={styles.receipt}>
                          <ul className={styles.receiptRounds}>
                            {rounds.map((round) => (
                              <li
                                key={round.roundNumber}
                                className={styles.receiptMod}
                              >
                                <span className={styles.receiptModLabel}>
                                  Round {round.roundNumber}
                                </span>
                                <span className={styles.receiptModPts}>
                                  {formatSignedPoints(round.points).replace('+', '')}
                                </span>
                              </li>
                            ))}
                          </ul>
                          <div className={styles.receiptTotal}>
                            <span>Total</span>
                            <span>{shownPoints}</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>

        {matchReport?.rated && matchReport.ratingBefore && matchReport.ratingAfter && (
          <>
            {charter &&
            charter.before.displayRating !== matchReport.ratingBefore.displayRating ? (
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
                    beforeRating={{ mu: charter.before.mu, sigma: charter.before.sigma, matches: charter.before.matches }}
                    beforeGrade={charter.before.displayGrade?.charAt(0) as any}
                    afterRating={{ mu: charter.after.mu, sigma: charter.after.sigma, matches: charter.after.matches }}
                    afterGrade={charter.after.displayGrade?.charAt(0) as any}
                    showDelta={true}
                    animate={true}
                  />
                </div>
              </>
            ) : (
              <div className={styles.roundEndBody}>
                <strong>
                  {'squadId' in matchReport && matchReport.squadId
                    ? 'Squad TEI'
                    : onlineReport?.charterId
                      ? 'Crew TEI'
                      : 'TEI'}
                </strong> (
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
            onDownloadYourMoves={() => void onDownloadAdvisorReport(false)}
            onDownloadAllCaptains={() => void onDownloadAdvisorReport(true)}
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
