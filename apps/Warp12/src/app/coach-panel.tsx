import type { WarpAiAction } from 'warp12-engine';

import { formatCoachSuggestion } from 'warp12-react';
import styles from './coach-panel.module.scss';

export interface CoachPanelProps {
  suggestion: WarpAiAction;
  reasons?: readonly string[];
  names: Readonly<Record<string, string>>;
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
      <p className={styles.suggestion}>{formatCoachSuggestion(suggestion, names)}</p>
      {reasons.length > 0 && (
        <ul className={styles.reasons}>
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
      <p className={styles.hint}>
        {pinned
          ? 'Teaching mode — advisor updates on your turn. You still confirm each move.'
          : reasons.length > 0
            ? 'Looks a few moves ahead; bullets above are the main factors for this chart.'
            : 'Highlight shows the recommended play — you still confirm the move.'}
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
