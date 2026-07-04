import type { DoubleZeroScore } from 'warp12-engine';

import styles from './lobby.module.scss';

export interface DoubleZeroScoreFieldProps {
  value: DoubleZeroScore | undefined;
  disabled?: boolean;
  onChange: (value: DoubleZeroScore) => void;
}

function normalize(value: number): DoubleZeroScore {
  return value === 0 ? 0 : value === 25 ? 25 : 50;
}

/** Double-blank (0-0) scoring selector. Prominent setup option (top of Game options). */
export function DoubleZeroScoreField({
  value,
  disabled = false,
  onChange,
}: DoubleZeroScoreFieldProps) {
  return (
    <label className={styles.field}>
      <span>Double-blank (0-0) score</span>
      <select
        aria-label="Double-blank (0-0) score"
        value={value ?? 50}
        disabled={disabled}
        onChange={(e) => onChange(normalize(Number(e.target.value)))}
      >
        <option value={50}>50 (tournament standard)</option>
        <option value={25}>25</option>
        <option value={0}>0 (pips — Warp 12 default)</option>
      </select>
    </label>
  );
}
