import { useState } from 'react';

import {
  aiSkillToTacticalClass,
  defaultAcademyTei,
  formatAiSkillUnratedLabel,
  formatTei,
  formatTacticalClass,
  playerTacticalClassTagline,
  TEI_OBJECTIVE_LABEL,
  WARP_SKILL_LEVELS,
  type WarpSkillLevel,
} from 'warp12-engine';

import type { RatedObjective } from '../firebase/stats-schema.js';
import styles from './lobby.module.scss';

const OBJECTIVE_LABELS: Record<RatedObjective, string> = {
  'go-out': TEI_OBJECTIVE_LABEL['go-out'],
  points: TEI_OBJECTIVE_LABEL.points,
};

export function AcademyPlacementFieldset({
  objective,
  saving,
  onSave,
}: {
  objective: RatedObjective;
  saving?: boolean;
  onSave: (skill: WarpSkillLevel) => void | Promise<void>;
}) {
  const [skill, setSkill] = useState<WarpSkillLevel>('lieutenant');
  const [error, setError] = useState<string | null>(null);

  const trackLabel = OBJECTIVE_LABELS[objective];
  const tacticalClass = aiSkillToTacticalClass(skill);
  const benchmarkTei = defaultAcademyTei(skill, objective);

  const commit = () => {
    setError(null);
    void Promise.resolve(onSave(skill)).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    });
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend>Federation Academy — {trackLabel}</legend>
      {error && <p className={styles.error}>{error}</p>}
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
            <span>
              {formatAiSkillUnratedLabel(level)}
              {' · '}
              {formatTei(defaultAcademyTei(level, objective), true)} benchmark
            </span>
          </label>
        ))}
      </div>
      <div className={styles.inlineRow}>
        <p className={styles.hint}>
          {formatTacticalClass(tacticalClass)} benchmark:{' '}
          <strong>{formatTei(benchmarkTei, true)}</strong>
        </p>
        <button
          type="button"
          className={styles.secondary}
          disabled={saving}
          onClick={commit}
        >
          {saving ? 'Saving…' : `Save ${trackLabel} profile`}
        </button>
      </div>
      <p className={styles.hint}>
        {playerTacticalClassTagline(tacticalClass)}. Saved once per track. After
        your first unassisted {trackLabel} match, TEI comes from play only.
        Class I is earned — not selected at onboarding.
      </p>
    </fieldset>
  );
}
