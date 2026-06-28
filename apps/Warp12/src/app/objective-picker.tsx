import {
  GAME_OBJECTIVE_LABELS,
  type GameObjective,
} from 'warp12-engine';

import styles from './lobby.module.scss';

export interface ObjectivePickerProps {
  name: string;
  value: GameObjective;
  onChange?: (objective: GameObjective) => void;
  disabled?: boolean;
}

/** Go out vs points — shared by local setup and online sector host settings. */
export function ObjectivePicker({
  name,
  value,
  onChange,
  disabled = false,
}: ObjectivePickerProps) {
  const readOnly = !onChange;

  return (
    <fieldset className={styles.fieldset}>
      <legend>Victory objective</legend>
      {(['go-out', 'penalty'] as const).map((objective) => (
        <label key={objective} className={styles.radioRow}>
          <input
            type="radio"
            name={name}
            checked={value === objective}
            disabled={disabled || readOnly}
            onChange={() => onChange?.(objective)}
          />
          <span>{GAME_OBJECTIVE_LABELS[objective]}</span>
        </label>
      ))}
    </fieldset>
  );
}

export interface ObjectiveSummaryProps {
  objective: GameObjective;
}

/** Read-only objective for joiners in the waiting room. */
export function ObjectiveSummary({ objective }: ObjectiveSummaryProps) {
  return (
    <fieldset className={`${styles.fieldset} ${styles.readOnlyFieldset}`}>
      <legend>Victory objective</legend>
      {(['go-out', 'penalty'] as const).map((value) => (
        <label
          key={value}
          className={`${styles.radioRow} ${
            value === objective ? styles.radioRowSelected : styles.radioRowMuted
          }`}
        >
          <input
            type="radio"
            name="sector-objective-summary"
            checked={value === objective}
            tabIndex={-1}
            onChange={() => {}}
          />
          <span>{GAME_OBJECTIVE_LABELS[value]}</span>
        </label>
      ))}
    </fieldset>
  );
}
