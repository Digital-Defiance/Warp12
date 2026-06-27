import type { WarpAiAction } from '@warp12/Warp12-lib';

import { formatCoachSuggestion } from '../game/warp-coach';
import styles from './coach-panel.module.scss';

export interface CoachPanelProps {
  suggestion: WarpAiAction;
  names: Readonly<Record<string, string>>;
  busy?: boolean;
  onApply: () => void;
  onDismiss: () => void;
}

export function CoachPanel({
  suggestion,
  names,
  busy = false,
  onApply,
  onDismiss,
}: CoachPanelProps) {
  return (
    <div className={styles.panel} role="region" aria-label="Tactical advisor">
      <div className={styles.header}>
        <span className={styles.badge} aria-hidden>
          ★
        </span>
        <p className={styles.title}>Tactical advisor</p>
      </div>
      <p className={styles.suggestion}>{formatCoachSuggestion(suggestion, names)}</p>
      <p className={styles.hint}>
        Highlight shows the recommended play — you still confirm the move.
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
        <button type="button" className={styles.dismissBtn} onClick={onDismiss}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
