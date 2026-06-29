import type { HouseRulesConfig } from 'warp12-engine';

import styles from './lobby.module.scss';

export interface HouseRulesOptionsProps {
  value: HouseRulesConfig;
  disabled?: boolean;
  onChange: (patch: Partial<HouseRulesConfig>) => void;
}

export function HouseRulesOptions({
  value,
  disabled = false,
  onChange,
}: HouseRulesOptionsProps) {
  return (
    <>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.requireOwnTrailFirst ?? false}
          disabled={disabled}
          onChange={(e) =>
            onChange({ requireOwnTrailFirst: e.target.checked })
          }
        />
        <span>Require own trail first (Deluxe-style)</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.neutralZoneAfterAllTrails ?? false}
          disabled={disabled}
          onChange={(e) =>
            onChange({ neutralZoneAfterAllTrails: e.target.checked })
          }
        />
        <span>Neutral Zone after all trails started (Deluxe-style)</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.beaconClearsOnAnyPlay ?? false}
          disabled={disabled}
          onChange={(e) =>
            onChange({ beaconClearsOnAnyPlay: e.target.checked })
          }
        />
        <span>Beacon clears on any play (Deluxe-style)</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.roundStarterPlaysTwo ?? false}
          disabled={disabled}
          onChange={(e) =>
            onChange({ roundStarterPlaysTwo: e.target.checked })
          }
        />
        <span>Round starter plays two tiles (Deluxe-style)</span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.dropToImpulseCall ?? false}
          disabled={disabled}
          onChange={(e) => onChange({ dropToImpulseCall: e.target.checked })}
        />
        <span>Drop to Impulse (announce at one tile; opponents may catch)</span>
      </label>
    </>
  );
}
