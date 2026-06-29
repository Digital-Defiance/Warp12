import type { SubspaceFractureScope } from 'warp12-engine';
import { SUBSPACE_FRACTURE_SCOPES } from 'warp12-engine';

import styles from './lobby.module.scss';

const SCOPE_LABELS: Record<SubspaceFractureScope, string> = {
  'own-trail': 'Own Trail',
  'all-captains': 'All Captains',
  'all-doubles': 'All Doubles',
};

export interface SubspaceFractureOptionsProps {
  enabled: boolean;
  scope: SubspaceFractureScope;
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onScopeChange: (scope: SubspaceFractureScope) => void;
}

export function SubspaceFractureOptions({
  enabled,
  scope,
  disabled = false,
  onEnabledChange,
  onScopeChange,
}: SubspaceFractureOptionsProps) {
  return (
    <>
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={enabled}
          disabled={disabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        <span>Subspace Fracture (chicken foot on doubles)</span>
      </label>
      {enabled ? (
        <label className={styles.field}>
          <span>Fracture scope</span>
          <select
            aria-label="Subspace Fracture scope"
            value={scope}
            disabled={disabled}
            onChange={(e) =>
              onScopeChange(e.target.value as SubspaceFractureScope)
            }
          >
            {SUBSPACE_FRACTURE_SCOPES.map((option) => (
              <option key={option} value={option}>
                {SCOPE_LABELS[option]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </>
  );
}

export { SCOPE_LABELS as SUBSPACE_FRACTURE_SCOPE_LABELS };
