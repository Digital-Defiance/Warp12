import type { WarpAiAction } from 'warp12-engine';

import { coachActionKind, formatCoachSuggestion, type CoachSuggestionFormatOptions } from 'warp12-react';
import styles from './coach-panel.module.scss';

function coachHint(
  action: WarpAiAction,
  pinned: boolean,
  reasonsCount: number
): string {
  if (pinned) {
    return 'Teaching mode — advisor updates on your turn. You still confirm each move.';
  }
  if (reasonsCount === 0) {
    return 'Highlight shows the recommended play — you still confirm the move.';
  }
  switch (coachActionKind(action)) {
    case 'draw':
    case 'pass-red-alert':
    case 'pass-turn':
    case 'deploy-beacon':
    case 'raise-shields':
      return 'Bullets above cite the rules for why this resolution is legal now.';
    case 'all-stop':
    case 'drop-to-impulse':
    case 'catch-drop-to-impulse':
      return 'Bullets above explain the ceremony or house-rule action.';
    case 'chart':
      return 'Runs ISMCTS deep search; bullets above are the main factors for this chart.';
    default:
      return 'Bullets above explain the recommended action.';
  }
}

export interface CoachPanelProps {
  suggestion: WarpAiAction;
  reasons?: readonly string[];
  names: Readonly<Record<string, string>>;
  suggestionFormat?: CoachSuggestionFormatOptions;
  busy?: boolean;
  pinned?: boolean;
  embedded?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function CoachPanel({
  suggestion,
  reasons = [],
  names,
  suggestionFormat,
  busy = false,
  pinned = false,
  embedded = false,
  onApply,
  onDismiss,
}: CoachPanelProps) {
  return (
    <div
      className={embedded ? styles.embedded : styles.panel}
      role="region"
      aria-label="Tactical advisor"
    >
      {!embedded && (
        <div className={styles.header}>
          <span className={styles.badge} aria-hidden>
            ★
          </span>
          <p className={styles.title}>Tactical advisor</p>
        </div>
      )}
      <p className={styles.suggestion}>
        {formatCoachSuggestion(suggestion, names, suggestionFormat)}
      </p>
      {reasons.length > 0 && (
        <ul className={styles.reasons}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <p className={styles.hint}>
        {coachHint(suggestion, pinned, reasons.length)}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.applyBtn}
          disabled={busy}
          onClick={onApply}
        >
          Highlight suggestion
        </button>
        {!pinned && (
          <button type="button" className={styles.dismissBtn} onClick={onDismiss}>
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}
