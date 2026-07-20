import { useEffect, useId, useState } from 'react';

import styles from './captain-identity-fieldset.module.scss';
import {
  captainGenderLabel,
  captainPilotIcon,
  CAPTAIN_GENDER_OPTIONS,
  type CaptainGender,
} from '../game/captain-profile.js';
import {
  CAPTAIN_PRONOUN_PRESETS,
  captainPronounsLabel,
  type CaptainPronounPreference,
  type PronounPresetId,
} from '../game/captain-pronouns.js';

export interface CaptainIdentityFieldsetProps {
  gender: CaptainGender;
  onGenderChange: (gender: CaptainGender) => void;
  pronouns: CaptainPronounPreference;
  onPronounsChange: (preference: CaptainPronounPreference) => void;
  speakAs: string | null;
  onSpeakAsChange: (speakAs: string | null) => void;
  disabled?: boolean;
}

/**
 * Avatar + pronouns in one profile block. Choices are independent —
 * e.g. female avatar with they/them is valid.
 */
export function CaptainIdentityFieldset({
  gender,
  onGenderChange,
  pronouns,
  onPronounsChange,
  speakAs,
  onSpeakAsChange,
  disabled = false,
}: CaptainIdentityFieldsetProps) {
  const customId = useId();
  const speakAsId = useId();
  const [customDraft, setCustomDraft] = useState(pronouns.custom ?? '');
  const [speakAsDraft, setSpeakAsDraft] = useState(speakAs ?? '');

  useEffect(() => {
    setCustomDraft(pronouns.custom ?? '');
  }, [pronouns.custom]);

  useEffect(() => {
    setSpeakAsDraft(speakAs ?? '');
  }, [speakAs]);

  const selectPreset = (preset: PronounPresetId) => {
    if (preset === 'custom') {
      onPronounsChange({ preset: 'custom', custom: customDraft.trim() });
      return;
    }
    onPronounsChange({ preset });
  };

  return (
    <fieldset className={styles.fieldset} disabled={disabled}>
      <legend>Captain profile</legend>
      <p className={styles.hint}>
        Avatar is for advisor-report icons. Pronouns and spoken-as are for
        commentator copy and TTS. Pick each separately — they are not the same
        setting.
      </p>

      <div className={styles.section}>
        <p className={styles.sectionLabel} id={`${customId}-avatar`}>
          Avatar
        </p>
        <div
          className={styles.options}
          role="radiogroup"
          aria-labelledby={`${customId}-avatar`}
        >
          {CAPTAIN_GENDER_OPTIONS.map((option) => {
            const selected = gender === option;
            return (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={selected}
                className={styles.option}
                data-selected={selected ? 'true' : undefined}
                onClick={() => onGenderChange(option)}
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
      </div>

      <div className={styles.section}>
        <p className={styles.sectionLabel} id={`${customId}-pronouns`}>
          Pronouns
        </p>
        <div
          className={styles.options}
          role="radiogroup"
          aria-labelledby={`${customId}-pronouns`}
        >
          {CAPTAIN_PRONOUN_PRESETS.map((option) => {
            const selected = pronouns.preset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={styles.option}
                data-selected={selected ? 'true' : undefined}
                onClick={() => selectPreset(option.id)}
              >
                <span>{option.label}</span>
              </button>
            );
          })}
        </div>
        {pronouns.preset === 'custom' ? (
          <label className={styles.customRow} htmlFor={customId}>
            <span className={styles.customLabel}>Custom forms</span>
            <input
              id={customId}
              type="text"
              className={styles.customInput}
              value={customDraft}
              placeholder="xe/xem/xyr or xe/xem/xyr/xyrs"
              aria-describedby={`${customId}-hint`}
              onChange={(event) => {
                const next = event.target.value;
                setCustomDraft(next);
                onPronounsChange({ preset: 'custom', custom: next });
              }}
            />
            <span id={`${customId}-hint`} className={styles.hint}>
              Enter subject/object/possessive (optional independent), separated
              by slashes. Default narration is they / them / their.
            </span>
          </label>
        ) : (
          <p className={styles.hint} role="status">
            Narration will use {captainPronounsLabel(pronouns)}.
          </p>
        )}
      </div>

      <div className={styles.section}>
        <label className={styles.sectionLabel} htmlFor={speakAsId}>
          Spoken as
        </label>
        <input
          id={speakAsId}
          type="text"
          className={styles.customInput}
          value={speakAsDraft}
          maxLength={48}
          placeholder="How TTS should say your call sign"
          aria-describedby={`${speakAsId}-hint`}
          onChange={(event) => {
            setSpeakAsDraft(event.target.value);
          }}
          onBlur={() => {
            const trimmed = speakAsDraft.trim();
            onSpeakAsChange(trimmed ? trimmed : null);
          }}
        />
        <p id={`${speakAsId}-hint`} className={styles.hint}>
          Optional pronunciation for commentary audio (e.g. Blitz → Blahtz).
          Plain text only — no markup. Your visible call sign is unchanged.
          Snapshotted when you join a sector; host can clear it before launch.
        </p>
      </div>
    </fieldset>
  );
}
