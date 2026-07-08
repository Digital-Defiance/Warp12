import type { LargeFleetHandSize } from 'warp12-engine';

import styles from './lobby.module.scss';

export interface LargeFleetHandSizeFieldProps {
  value: LargeFleetHandSize | undefined;
  disabled?: boolean;
  onChange: (value: LargeFleetHandSize) => void;
}

function normalize(value: number): LargeFleetHandSize {
  return value === 11 ? 11 : 10;
}

/**
 * Hand size for 7–8 captain fleets — the one setup value where published rule
 * sets disagree (10 = Masters of Games / modern sets; 11 = Galt 1994 /
 * University Games). Only meaningful for large fleets.
 */
export function LargeFleetHandSizeField({
  value,
  disabled = false,
  onChange,
}: LargeFleetHandSizeFieldProps) {
  return (
    <label className={styles.field}>
      <span>Large fleet hand size (7–8 captains)</span>
      <select
        aria-label="Large fleet hand size (7–8 captains)"
        value={value ?? 10}
        disabled={disabled}
        onChange={(e) => onChange(normalize(Number(e.target.value)))}
      >
        <option value={10}>10 tiles (Warp 12 default)</option>
        <option value={11}>11 tiles (Galt / University Games)</option>
      </select>
    </label>
  );
}
