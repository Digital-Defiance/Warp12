/**
 * TeiChange Component
 * 
 * Shows rating changes after match completion with animations.
 * Highlights grade promotions/demotions with special effects.
 */

import type { JSX } from 'react';
import { type PlayerRating, type TeiGrade, getTeiDisplay } from 'warp12-engine';
import { TeiDisplay } from './tei-display.js';
import styles from './tei-change.module.scss';

export interface TeiChangeProps {
  /** Rating before match */
  beforeRating: PlayerRating;
  /** Grade before match (for hysteresis) */
  beforeGrade?: TeiGrade;
  /** Rating after match */
  afterRating: PlayerRating;
  /** Grade after match (for hysteresis) */
  afterGrade?: TeiGrade;
  /** Show delta (+2, -3, etc.) */
  showDelta?: boolean;
  /** Animate the change */
  animate?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Display rating change with before → after animation.
 * Celebrates grade promotions with special styling.
 */
export function TeiChange({
  beforeRating,
  beforeGrade,
  afterRating,
  afterGrade,
  showDelta = true,
  animate = true,
  className = '',
}: TeiChangeProps): JSX.Element {
  const beforeTei = getTeiDisplay(beforeRating, beforeGrade);
  const afterTei = getTeiDisplay(afterRating, afterGrade);

  const scoreDelta = afterTei.score - beforeTei.score;
  const gradeChanged = beforeTei.grade !== afterTei.grade;
  const gradeImproved = gradeChanged && isGradeImprovement(beforeTei.grade, afterTei.grade);

  const deltaText = scoreDelta > 0 ? `+${scoreDelta}` : `${scoreDelta}`;
  const deltaClass = scoreDelta > 0 ? 'positive' : scoreDelta < 0 ? 'negative' : 'neutral';

  return (
    <div className={`${styles['tei-change']} ${animate ? styles['tei-change--animate'] : ''} ${className}`}>
      <div className={styles['tei-change__before']}>
        <TeiDisplay
          rating={beforeRating}
          currentGrade={beforeGrade}
          size="medium"
          showTooltip={false}
        />
      </div>

      <div className={styles['tei-change__arrow']}>→</div>

      <div className={`${styles['tei-change__after']} ${gradeImproved ? styles['tei-change__after--promoted'] : ''}`}>
        <TeiDisplay
          rating={afterRating}
          currentGrade={afterGrade}
          size="medium"
          showTooltip={false}
        />
      </div>

      {showDelta && scoreDelta !== 0 && (
        <div className={`${styles['tei-change__delta']} ${styles[`tei-change__delta--${deltaClass}`]}`}>
          ({deltaText})
        </div>
      )}

      {gradeChanged && (
        <div className={`${styles['tei-change__badge']} ${gradeImproved ? styles['tei-change__badge--promotion'] : styles['tei-change__badge--demotion']}`}>
          {gradeImproved ? '⬆' : '⬇'} Grade {gradeImproved ? 'Promotion' : 'Change'}
        </div>
      )}
    </div>
  );
}

/**
 * Check if new grade is better than old grade.
 * Grade order: E > V > C > I > P (lower index = better)
 */
function isGradeImprovement(oldGrade: TeiGrade, newGrade: TeiGrade): boolean {
  const gradeOrder: TeiGrade[] = ['E', 'V', 'C', 'I', 'P'];
  const oldIndex = gradeOrder.indexOf(oldGrade);
  const newIndex = gradeOrder.indexOf(newGrade);
  return newIndex < oldIndex; // Lower index = better grade
}
