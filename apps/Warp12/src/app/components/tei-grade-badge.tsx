/**
 * TeiGradeBadge Component
 *
 * Compact grade indicator showing just the letter in a colored circle.
 * Used in leaderboards, player cards, and compact views.
 */

import { useCallback, useRef, useState, type JSX } from 'react';
import { createPortal } from 'react-dom';
import {
  type TeiGrade,
  getTeiGradeName,
  getTeiGradeDescription,
  getTeiGradeColor,
} from 'warp12-engine';
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

interface TipAnchor {
  x: number;
  y: number;
  above: boolean;
}

/**
 * Compact grade badge - just the letter in a colored circle.
 * Perfect for tables, lists, and in-game HUD.
 *
 * The tooltip is rendered through a portal to `document.body` rather than a
 * native `title` — native tooltips don't render in the Tauri webviews, and a
 * CSS tooltip would be clipped by the floating panel's `overflow: hidden`.
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

  const badgeRef = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<TipAnchor | null>(null);

  const openTip = useCallback(() => {
    const el = badgeRef.current;
    if (!el) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const above = rect.top > 72;
    setTip({
      x: rect.left + rect.width / 2,
      y: above ? rect.top - 6 : rect.bottom + 6,
      above,
    });
  }, []);
  const closeTip = useCallback(() => setTip(null), []);

  const interactive = showTooltip
    ? {
        onPointerEnter: openTip,
        onPointerLeave: closeTip,
        onFocus: openTip,
        onBlur: closeTip,
        tabIndex: 0,
      }
    : {};

  return (
    <span
      ref={badgeRef}
      className={`${styles['tei-badge']} ${styles[`tei-badge--${colorClass}`]} ${styles[`tei-badge--size-${size}`]} ${className}`}
      aria-label={`${gradeName} grade — ${gradeDescription}`}
      {...interactive}
    >
      {grade}
      {showTooltip && tip && typeof document !== 'undefined'
        ? createPortal(
            <span
              role="tooltip"
              className={styles.tooltip}
              data-above={tip.above ? 'true' : undefined}
              style={{ left: tip.x, top: tip.y }}
            >
              <span className={styles.tooltipName}>{gradeName}</span>
              <span className={styles.tooltipDesc}>{gradeDescription}</span>
            </span>,
            document.body
          )
        : null}
    </span>
  );
}
