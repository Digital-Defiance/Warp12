import {
  clampCampaignRounds,
  defaultCampaignRounds,
  GAME_OBJECTIVE_LABELS,
  MIN_CAMPAIGN_ROUNDS,
  type GameObjective,
} from 'warp12-engine';

import styles from './lobby.module.scss';

export interface ObjectivePickerProps {
  name: string;
  value: GameObjective;
  onChange?: (objective: GameObjective) => void;
  disabled?: boolean;
}

/** Points first — penalty is the default victory objective. */
const OBJECTIVE_OPTIONS = ['points', 'go-out'] as const satisfies readonly GameObjective[];

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
      {OBJECTIVE_OPTIONS.map((objective) => (
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

export interface CampaignRoundsFieldProps {
  value: number;
  onChange?: (rounds: number) => void;
  disabled?: boolean;
  /** Warp factor — caps campaign length (10 / 13 / 16 / 19). */
  maxPip?: number;
}

/** Penalty campaign length — shown when the points objective is selected. */
export function CampaignRoundsField({
  value,
  onChange,
  disabled = false,
  maxPip = 12,
}: CampaignRoundsFieldProps) {
  const readOnly = !onChange;
  const maxRounds = defaultCampaignRounds(maxPip);
  const clamped = clampCampaignRounds(value, maxPip);

  return (
    <label className={styles.field}>
      <span>
        Campaign length ({MIN_CAMPAIGN_ROUNDS}–{maxRounds} rounds)
      </span>
      <select
        aria-label="Campaign length"
        value={clamped}
        disabled={disabled || readOnly}
        onChange={(event) =>
          onChange?.(clampCampaignRounds(Number(event.target.value), maxPip))
        }
      >
        {Array.from(
          { length: maxRounds - MIN_CAMPAIGN_ROUNDS + 1 },
          (_, index) => MIN_CAMPAIGN_ROUNDS + index
        ).map((rounds) => (
          <option key={rounds} value={rounds}>
            {rounds} round{rounds === 1 ? '' : 's'}
          </option>
        ))}
      </select>
    </label>
  );
}

export interface ObjectiveSummaryProps {
  objective: GameObjective;
  campaignRounds?: number;
}

/** Read-only objective for joiners in the waiting room. */
export function ObjectiveSummary({ objective, campaignRounds }: ObjectiveSummaryProps) {
  return (
    <>
      <fieldset className={`${styles.fieldset} ${styles.readOnlyFieldset}`}>
        <legend>Victory objective</legend>
        {OBJECTIVE_OPTIONS.map((value) => (
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
      {objective === 'points' && campaignRounds != null && (
        <fieldset className={`${styles.fieldset} ${styles.readOnlyFieldset}`}>
          <legend>Campaign length</legend>
          <p className={styles.subtitle}>
            {campaignRounds} round{campaignRounds === 1 ? '' : 's'}
          </p>
        </fieldset>
      )}
    </>
  );
}
