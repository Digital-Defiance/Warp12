import {
  officialRulesLabel,
  officialRulesSummary,
} from '../game/warp12-preset.js';
import styles from './lobby.module.scss';

export interface Warp12RulesPresetProps {
  disabled?: boolean;
  /** Active Warp factor — campaign length in the summary follows the set. */
  maxPip?: number;
  onApply: () => void;
}

export function Warp12RulesPreset({
  disabled = false,
  maxPip = 12,
  onApply,
}: Warp12RulesPresetProps) {
  return (
    <div className={styles.presetPanel}>
      <button
        type="button"
        className={styles.presetButton}
        disabled={disabled}
        onClick={onApply}
      >
        {officialRulesLabel(maxPip)}
      </button>
      <p className={styles.hint}>{officialRulesSummary(maxPip)}</p>
    </div>
  );
}
