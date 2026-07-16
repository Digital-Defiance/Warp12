/**
 * TeiDisplay Component
 *
 * Primary rating display: TEI grade ("V67") + federation commission rank.
 * OpenSkill μ/σ only when Advanced rating details is on.
 */

import type { JSX } from 'react';
import {
  type PlayerRating,
  type TeiGrade,
  getTeiDisplay,
  getTeiGradeName,
  getTeiGradeDescription,
  getTeiGradeColor,
  getTeiRank,
  isFlagOfficerRank,
} from 'warp12-engine';
import type { RatingTrack } from 'warp12-engine';
import { readUserPrefs } from '../user-prefs.js';
import styles from './tei-display.module.scss';

export interface TeiDisplayProps {
  /** OpenSkill rating (μ, σ, matches) */
  rating: PlayerRating;
  /** Current displayed grade for hysteresis (letter or legacy `V67`) */
  currentGrade?: TeiGrade | string;
  /** Optional objective label ('goOut' | 'points') */
  objective?: RatingTrack;
  /** Display size */
  size?: 'small' | 'medium' | 'large';
  /** Show tooltip on hover (default: true) */
  showTooltip?: boolean;
  /** Show objective label above rating */
  showLabel?: boolean;
  /** Show federation rank under the badge (default: true) */
  showRank?: boolean;
  /** Override Advanced μ/σ (default: user prefs) */
  showAdvanced?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Main TEI rating display component.
 */
export function TeiDisplay({
  rating,
  currentGrade,
  objective,
  size = 'medium',
  showTooltip = true,
  showLabel = false,
  showRank = true,
  showAdvanced,
  className = '',
}: TeiDisplayProps): JSX.Element {
  const tei = getTeiDisplay(rating, currentGrade);
  const rank = getTeiRank(tei);
  const gradeName = getTeiGradeName(tei.grade);
  const gradeDescription = getTeiGradeDescription(tei.grade);
  const colorClass = getTeiGradeColor(tei.grade);
  const advanced =
    showAdvanced ??
    (typeof window !== 'undefined'
      ? readUserPrefs().showAdvancedStats
      : false);

  const labelText =
    objective === 'goOut'
      ? 'Go-Out Rating'
      : objective === 'points'
        ? 'Points Rating'
        : null;

  const ariaLabel = [
    `${rank.name},`,
    `${gradeName} grade,`,
    `${tei.score} out of 99`,
    advanced
      ? `, skill ${rating.mu.toFixed(1)}, confidence ${rating.sigma.toFixed(1)}, ${rating.matches} matches`
      : `, ${rating.matches} matches`,
  ].join(' ');

  return (
    <div
      className={`${styles['tei-display']} ${styles[`tei-display--size-${size}`]} ${className}`}
    >
      {showLabel && labelText && (
        <div
          className={styles['tei-display__label']}
          id={`tei-label-${objective}`}
        >
          {labelText}
        </div>
      )}
      <div
        className={styles['tei-display__rating']}
        role="status"
        aria-label={ariaLabel}
        aria-describedby={showTooltip ? `tei-tooltip-${objective}` : undefined}
        tabIndex={0}
      >
        <span
          className={`${styles['tei-grade']} ${styles[`tei-grade--${colorClass}`]}`}
        >
          {tei.grade}
        </span>
        <span className={styles['tei-score']}>{tei.score}</span>

        {showTooltip && (
          <div
            className={styles['tei-tooltip']}
            id={`tei-tooltip-${objective}`}
            role="tooltip"
            aria-hidden="true"
          >
            <div className={styles['tei-tooltip__title']}>
              {rank.name}
              {isFlagOfficerRank(rank) ? ' · Flag Officer' : ''}
            </div>
            <div className={styles['tei-tooltip__stat']}>
              <span className={styles['tei-tooltip__label']}>TEI</span>
              <span className={styles['tei-tooltip__value']}>{tei.formatted}</span>
            </div>
            <div className={styles['tei-tooltip__stat']}>
              <span className={styles['tei-tooltip__label']}>Confidence</span>
              <span className={styles['tei-tooltip__value']}>
                {gradeName} — {gradeDescription}
              </span>
            </div>
            <div className={styles['tei-tooltip__stat']}>
              <span className={styles['tei-tooltip__label']}>Skill score</span>
              <span className={styles['tei-tooltip__value']}>{tei.score}/99</span>
            </div>
            <div className={styles['tei-tooltip__stat']}>
              <span className={styles['tei-tooltip__label']}>Matches</span>
              <span className={styles['tei-tooltip__value']}>{rating.matches}</span>
            </div>
            {advanced && (
              <>
                <div className={styles['tei-tooltip__divider']} />
                <div className={styles['tei-tooltip__stat']}>
                  <span className={styles['tei-tooltip__label']}>Skill (μ)</span>
                  <span className={styles['tei-tooltip__value']}>
                    {rating.mu.toFixed(1)}
                  </span>
                </div>
                <div className={styles['tei-tooltip__stat']}>
                  <span className={styles['tei-tooltip__label']}>
                    Uncertainty (σ)
                  </span>
                  <span className={styles['tei-tooltip__value']}>
                    {rating.sigma.toFixed(1)}
                  </span>
                </div>
                <div className={styles['tei-tooltip__formula']}>
                  Conservative rating μ − 3σ ={' '}
                  {(rating.mu - 3 * rating.sigma).toFixed(1)}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {showRank && (
        <div className={styles['tei-display__rank']} title={rank.name}>
          {size === 'small' ? rank.short : rank.name}
        </div>
      )}
    </div>
  );
}
