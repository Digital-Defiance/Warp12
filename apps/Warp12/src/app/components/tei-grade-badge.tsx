/**
 * TeiGradeBadge Component
 * 
 * Compact grade indicator showing just the letter in a colored circle.
 * Used in leaderboards, player cards, and compact views.
 */

import { type TeiGrade, getTeiGradeName, getTeiGradeDescription, getTeiGradeColor } from 'warp12-engine';
import styles from './tei-grade-badge.module.scss';

export interface TeiGradeBadgeProps {
  /** TEI confidence grade letter */
  grade: TeiGrade;
  /** Badge size */
  size?: 'small' | 'medium';
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional CSS class */
  className?: string;
}

/**
 * Compact grade badge - just the letter in a colored circle.
 * Perfect for tables, lists, and in-game HUD.
 */
export function TeiGradeBadge({
  grade,
  size = 'medium',
  showTooltip = true,
  className = '',
}: TeiGradeBadgeProps): JSX.Element {
  const gradeName = getTeiGradeName(grade);
  const gradeDescription = getTeiGradeDescription(grade);
  const colorClass = getTeiGradeColor(grade);

  const title = showTooltip ? `${gradeName}\n${gradeDescription}` : undefined;

  return (
    <span
      className={`${styles['tei-badge']} ${styles[`tei-badge--${colorClass}`]} ${styles[`tei-badge--size-${size}`]} ${className}`}
      title={title}
      aria-label={`${gradeName} grade`}
    >
      {grade}
    </span>
  );
}
