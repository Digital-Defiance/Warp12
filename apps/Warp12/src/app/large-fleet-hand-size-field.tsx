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
 * Hand size for 7–8 captain fleets only — show only when the fleet is exactly
 * 7 or 8. Masters of Games / modern = 10; Galt 1994 / University Games = 11.
 */
export function LargeFleetHandSizeField({
  value,
  disabled = false,
  onChange,
}: LargeFleetHandSizeFieldProps) {
  return (
    <label className={styles.field}>
      <span>Hand size at 7–8 captains</span>
      <select
        aria-label="Hand size at 7–8 captains"
        value={value ?? 10}
        disabled={disabled}
        onChange={(e) => onChange(normalize(Number(e.target.value)))}
      >
        <option value={10}>10 tiles (default)</option>
        <option value={11}>11 tiles (Galt / University Games)</option>
      </select>
      <span className={styles.hint}>
        Only applies at exactly 7 or 8 captains. Larger Warp 15 / 18 fleets use
        fixed profile sizes (not this control).
      </span>
    </label>
  );
}
