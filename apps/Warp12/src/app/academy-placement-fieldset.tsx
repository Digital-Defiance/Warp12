import { useEffect, useState } from 'react';

import {
  academyTeiBand,
  aiSkillToTacticalClass,
  clampAcademyTei,
  defaultAcademyTei,
  formatAiSkillUnratedLabel,
  formatTacticalClass,
  playerTacticalClassTagline,
  WARP_SKILL_LEVELS,
  type WarpSkillLevel,
} from 'warp12-engine';

import type { RatedObjective } from '../firebase/stats-schema.js';
import styles from './lobby.module.scss';

const OBJECTIVE_LABELS: Record<RatedObjective, string> = {
  'go-out': 'go-out',
  penalty: 'penalty',
};

export function AcademyPlacementFieldset({
  objective,
  saving,
  onSave,
}: {
  objective: RatedObjective;
  saving?: boolean;
  onSave: (skill: WarpSkillLevel, tei: number) => void | Promise<void>;
}) {
  const [skill, setSkill] = useState<WarpSkillLevel>('lieutenant');
  const [teiInput, setTeiInput] = useState(() =>
    String(defaultAcademyTei('lieutenant', objective))
  );

  useEffect(() => {
    setTeiInput(String(defaultAcademyTei(skill, objective)));
  }, [skill, objective]);

  const band = academyTeiBand(skill, objective);
  const trackLabel = OBJECTIVE_LABELS[objective];
  const tacticalClass = aiSkillToTacticalClass(skill);

  const commit = () => {
    const value = Number(teiInput);
    if (!Number.isFinite(value)) {
      return;
    }
    void onSave(skill, clampAcademyTei(skill, value, objective));
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend>Starfleet Academy — {trackLabel}</legend>
      <p className={styles.hint}>
        Everyone at the table is a <strong>Captain</strong>. Choose the{' '}
        <strong>tactical classification</strong> that should benchmark your{' '}
        {trackLabel} TEI — proficiency on file, not chain-of-command rank.
      </p>
      <div
        role="radiogroup"
        aria-label={`Academy tactical class for ${trackLabel}`}
      >
        {WARP_SKILL_LEVELS.map((level) => (
            <label
              key={level}
              className={`${styles.radioRow} ${
                skill === level ? styles.radioRowSelected : styles.radioRowMuted
              }`}
            >
              <input
                type="radio"
                name={`academy-class-${objective}`}
                value={level}
                checked={skill === level}
                onChange={() => setSkill(level)}
              />
              <span>{formatAiSkillUnratedLabel(level)}</span>
            </label>
        ))}
      </div>
      <label className={styles.field}>
        <span>
          Starting TEI for {trackLabel} ({band.min}–{band.max}) ·{' '}
          {formatTacticalClass(tacticalClass)}
        </span>
        <div className={styles.inlineRow}>
          <input
            type="number"
            min={band.min}
            max={band.max}
            step={25}
            value={teiInput}
            onChange={(e) => setTeiInput(e.target.value)}
          />
          <button
            type="button"
            className={styles.secondary}
            disabled={saving || !teiInput.trim()}
            onClick={commit}
          >
            {saving ? 'Saving…' : `Save ${trackLabel} profile`}
          </button>
        </div>
      </label>
      <p className={styles.hint}>
        {playerTacticalClassTagline(tacticalClass)}. Saved once per track. After
        your first unassisted {trackLabel} match, TEI comes from play only.
        Class I is earned — not selected at onboarding.
      </p>
    </fieldset>
  );
}
