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
 * University Games). Fleets of 9+ (Warp 15 / 18) use fixed profile sizes.
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
        Applies only when the fleet is 7 or 8. Larger exhibition fleets (9+) use
        fixed hand sizes for that Warp factor.
      </span>
    </label>
  );
}
