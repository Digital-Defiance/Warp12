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
      {value.dropToImpulseCall ? (
        <label className={styles.houseRulesSubOption}>
          <span>Catch penalty</span>
          <select
            value={value.dropToImpulseCatchPenalty ?? 1}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                dropToImpulseCatchPenalty: Number(e.target.value) === 2 ? 2 : 1,
              })
            }
          >
            <option value={1}>1 tile</option>
            <option value={2}>2 tiles</option>
          </select>
        </label>
      ) : null}
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.passRedAlertWithoutDraw ?? false}
          disabled={disabled}
          onChange={(e) =>
            onChange({ passRedAlertWithoutDraw: e.target.checked })
          }
        />
        <span>
          Pass Red Alert without drawing or shields down — only for the captain
          who charted the double, and only before it passes (Yellow alert)
        </span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.manualShieldControl ?? false}
          disabled={disabled}
          onChange={(e) =>
            onChange({ manualShieldControl: e.target.checked })
          }
        />
        <span>
          Manual shield control — open your train any time; close only after
          charting your own trail since opening; one shield change per turn
        </span>
      </label>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={value.allStopCeremony ?? true}
          disabled={disabled}
          onChange={(e) => onChange({ allStopCeremony: e.target.checked })}
        />
        <span>
          All Stop! ceremony (auto log/sound after Neutral Zone wins and All Stop!
          echo go-outs)
        </span>
      </label>
    </>
  );
}
