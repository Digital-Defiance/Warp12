/**
 * Match Rating Preview — Shows potential rating outcomes before game starts.
 * 
 * Uses previewTeiChange() to estimate "If you win: V65 → ~V67 | If you lose: V65 → ~V63"
 * 
 * Displays conservative estimates to manage expectations and avoid over-emphasizing
 * rating changes before the match.
 */

import { previewTeiChange, type TeiDisplay, type TeiGrade } from 'warp12-engine';
import type { StoredRating, RatedObjective } from '../firebase/stats-schema.js';
import styles from './match-rating-preview.module.scss';

interface MatchRatingPreviewProps {
  /** Current player rating for this objective */
  readonly currentRating: StoredRating;
  /** Current displayed grade (for hysteresis) */
  readonly currentGrade: string | undefined;
  /** Objective being played */
  readonly objective: RatedObjective;
  /** Optional: compact display mode */
  readonly compact?: boolean;
}

function formatChange(delta: number): string {
  if (delta > 0) return `+${delta}`;
  if (delta < 0) return `${delta}`;
  return '±0';
}

function formatTeiWithChange(tei: TeiDisplay, delta: number, gradeChange: boolean): string {
  const change = formatChange(delta);
  if (gradeChange) {
    return `${tei.formatted} (${change}) 📈`;
  }
  return `${tei.formatted} (${change})`;
}

export function MatchRatingPreview({
  currentRating,
  currentGrade,
  objective,
  compact = false,
}: MatchRatingPreviewProps) {
  // The prop is a loose display string; the engine wants the grade letter union.
  const grade = currentGrade as TeiGrade | undefined;
  const winPreview = previewTeiChange(currentRating, grade, true);
  const losePreview = previewTeiChange(currentRating, grade, false);

  if (compact) {
    return (
      <div className={styles.previewCompact}>
        <span className={styles.previewLabel}>Rating impact:</span>
        <span className={styles.previewScenario}>
          Win: {formatTeiWithChange(winPreview.estimatedTei, winPreview.scoreDelta, winPreview.gradeChange)}
        </span>
        <span className={styles.previewDivider}>|</span>
        <span className={styles.previewScenario}>
          Loss: {formatTeiWithChange(losePreview.estimatedTei, losePreview.scoreDelta, losePreview.gradeChange)}
        </span>
      </div>
    );
  }

  return (
    <div className={styles.preview}>
      <h3 className={styles.previewTitle}>Rating Preview ({objective === 'go-out' ? 'Go-out' : 'Points'})</h3>
      <div className={styles.previewCurrent}>
        <span className={styles.previewCurrentLabel}>Current rating:</span>
        <span className={styles.previewCurrentValue}>{winPreview.currentTei.formatted}</span>
      </div>
      <div className={styles.previewScenarios}>
        <div className={styles.previewScenarioCard}>
          <div className={styles.previewScenarioLabel}>If you win:</div>
          <div className={styles.previewScenarioValue}>
            {formatTeiWithChange(winPreview.estimatedTei, winPreview.scoreDelta, winPreview.gradeChange)}
          </div>
          {winPreview.gradeChange && (
            <div className={styles.previewScenarioNote}>Grade promotion!</div>
          )}
        </div>
        <div className={styles.previewScenarioCard}>
          <div className={styles.previewScenarioLabel}>If you lose:</div>
          <div className={styles.previewScenarioValue}>
            {formatTeiWithChange(losePreview.estimatedTei, losePreview.scoreDelta, losePreview.gradeChange)}
          </div>
          {losePreview.gradeChange && (
            <div className={styles.previewScenarioNote}>Grade change</div>
          )}
        </div>
      </div>
      <p className={styles.previewDisclaimer}>
        Estimates are approximate. Actual changes depend on opponent ratings and final ranks.
      </p>
    </div>
  );
}
