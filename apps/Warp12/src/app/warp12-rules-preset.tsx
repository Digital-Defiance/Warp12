import {
  WARP12_OFFICIAL_RULES_LABEL,
  WARP12_OFFICIAL_RULES_SUMMARY,
} from '../game/warp12-preset.js';
import styles from './lobby.module.scss';

export interface Warp12RulesPresetProps {
  disabled?: boolean;
  onApply: () => void;
}

export function Warp12RulesPreset({ disabled = false, onApply }: Warp12RulesPresetProps) {
  return (
    <div className={styles.presetPanel}>
      <button
        type="button"
        className={styles.presetButton}
        disabled={disabled}
        onClick={onApply}
      >
        {WARP12_OFFICIAL_RULES_LABEL}
      </button>
      <p className={styles.hint}>{WARP12_OFFICIAL_RULES_SUMMARY}</p>
    </div>
  );
}
