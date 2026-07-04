import { useCallback, useState } from 'react';

import {
  QUICK_COMM_GROUPS,
  type QuickCommGroup,
  type QuickCommPhrase,
} from '../game/quick-comms.js';
import styles from './quick-comms-wheel.module.scss';

export interface QuickCommsWheelProps {
  /** Called when the captain picks a phrase. */
  onSend: (phrase: QuickCommPhrase) => void;
  disabled?: boolean;
}

export function QuickCommsWheel({ onSend, disabled = false }: QuickCommsWheelProps) {
  const [expandedGroup, setExpandedGroup] = useState<QuickCommGroup | null>(null);

  const toggleGroup = useCallback(
    (group: QuickCommGroup) => {
      setExpandedGroup((current) => (current?.id === group.id ? null : group));
    },
    []
  );

  const handlePhrase = useCallback(
    (phrase: QuickCommPhrase) => {
      onSend(phrase);
      setExpandedGroup(null);
    },
    [onSend]
  );

  return (
    <div className={styles.wheel} role="toolbar" aria-label="Quick comms">
      <div className={styles.groups}>
        {QUICK_COMM_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            className={styles.groupBtn}
            aria-pressed={expandedGroup?.id === group.id}
            aria-label={group.label}
            title={group.label}
            disabled={disabled}
            onClick={() => toggleGroup(group)}
          >
            <img
              src={`/${group.icon}`}
              alt=""
              className={styles.groupIcon}
              aria-hidden="true"
            />
          </button>
        ))}
      </div>

      {expandedGroup && (
        <ul className={styles.phraseList} role="menu" aria-label={expandedGroup.label}>
          {expandedGroup.phrases.map((phrase) => (
            <li key={phrase.id} role="none">
              <button
                type="button"
                role="menuitem"
                className={styles.phraseBtn}
                disabled={disabled}
                onClick={() => handlePhrase(phrase)}
              >
                {phrase.text}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
