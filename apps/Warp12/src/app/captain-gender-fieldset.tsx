import styles from './captain-gender-fieldset.module.scss';

import {
  captainGenderLabel,
  captainPilotIcon,
  CAPTAIN_GENDER_OPTIONS,
  type CaptainGender,
} from '../game/captain-profile.js';

export interface CaptainGenderFieldsetProps {
  gender: CaptainGender;
  onChange: (gender: CaptainGender) => void;
  disabled?: boolean;
}

export function CaptainGenderFieldset({
  gender,
  onChange,
  disabled = false,
}: CaptainGenderFieldsetProps) {
  const options = CAPTAIN_GENDER_OPTIONS;

  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend>Captain avatar</legend>
      <p className={styles.hint}>
        Used for your advisor-report download icon in local and online play.
      </p>
      <div className={styles.options} role="radiogroup" aria-label="Captain avatar">
        {options.map((option) => {
          const selected = gender === option;
          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={selected}
              className={styles.option}
              data-selected={selected ? 'true' : undefined}
              onClick={() => onChange(option)}
            >
              <img
                src={captainPilotIcon(option)}
                alt=""
                className={styles.icon}
              />
              <span>{captainGenderLabel(option)}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
