import { useEffect, useMemo, useState } from 'react';
import {
  formatAiSkillUnratedLabel,
  type WarpSkillLevel,
} from 'warp12-engine';

import { isAiCaptain } from '../game/ai-captain.js';
import type { FirestoreCaptain } from '../firebase/schema.js';

import styles from './rules-view.module.scss';
import confirmStyles from './confirm-dialog.module.scss';
import dialogStyles from './host-leave-sector-dialog.module.scss';
import modStyles from './host-mod-dialog.module.scss';

const SKILL_OPTIONS: readonly WarpSkillLevel[] = [
  'ensign',
  'lieutenant',
  'commander',
];

export interface HostLeaveSectorDialogProps {
  open: boolean;
  onClose: () => void;
  onReturnToWaitingRoom: () => void;
  onDissolveSector: () => void;
  /** Mid-mission: leave without dissolve — AI takes your seat. */
  onLeaveWithAi?: (input: {
    newHostId: string;
    skill: WarpSkillLevel;
  }) => void | Promise<void>;
  captains?: readonly FirestoreCaptain[];
  hostId?: string;
  busy?: boolean;
}

export function HostLeaveSectorDialog({
  open,
  onClose,
  onReturnToWaitingRoom,
  onDissolveSector,
  onLeaveWithAi,
  captains = [],
  hostId = '',
  busy = false,
}: HostLeaveSectorDialogProps) {
  const [mode, setMode] = useState<'menu' | 'leave-ai'>('menu');
  const [newHostId, setNewHostId] = useState('');
  const [skill, setSkill] = useState<WarpSkillLevel>('lieutenant');

  const transferCandidates = useMemo(
    () =>
      captains.filter(
        (captain) => captain.id !== hostId && !isAiCaptain(captain)
      ),
    [captains, hostId]
  );

  const canLeaveWithAi =
    typeof onLeaveWithAi === 'function' && transferCandidates.length > 0;

  useEffect(() => {
    if (!open) {
      return;
    }
    setMode('menu');
    setSkill('lieutenant');
    setNewHostId(transferCandidates[0]?.id ?? '');
  }, [open, transferCandidates]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        if (mode !== 'menu') {
          setMode('menu');
          return;
        }
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [busy, mode, open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-host-leave-title"
      onClick={busy ? undefined : onClose}
    >
      <div
        className={`${styles.dialogPanel} ${confirmStyles.panel} ${dialogStyles.panel}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-host-leave-title" className={styles.dialogTitle}>
            {mode === 'leave-ai' ? 'Leave & continue' : 'Leave bridge?'}
          </h2>
          <button
            type="button"
            className={styles.dialogClose}
            onClick={onClose}
            disabled={busy}
          >
            Close
          </button>
        </header>
        <div className={`${styles.dialogBody} ${confirmStyles.body}`}>
          {mode === 'menu' ? (
            <>
              <p className={confirmStyles.message}>
                As host, choose how to leave. Returning to the waiting room
                keeps the sector code and crew. Leave &amp; continue hands your
                seat to an AI and transfers command. Dissolving removes
                everyone.
              </p>
              <div className={dialogStyles.actions}>
                <button
                  type="button"
                  className={confirmStyles.cancelBtn}
                  onClick={onClose}
                  disabled={busy}
                >
                  Keep playing
                </button>
                <button
                  type="button"
                  className={confirmStyles.confirmBtn}
                  onClick={onReturnToWaitingRoom}
                  disabled={busy}
                >
                  Return to waiting room
                </button>
                {canLeaveWithAi ? (
                  <button
                    type="button"
                    className={confirmStyles.confirmBtn}
                    onClick={() => setMode('leave-ai')}
                    disabled={busy}
                  >
                    Leave &amp; continue (AI seat)
                  </button>
                ) : null}
                <button
                  type="button"
                  className={confirmStyles.confirmBtn}
                  data-tone="danger"
                  onClick={onDissolveSector}
                  disabled={busy}
                >
                  Dissolve sector
                </button>
              </div>
              {!canLeaveWithAi && onLeaveWithAi ? (
                <p className={modStyles.hint}>
                  Leave &amp; continue needs another human captain aboard to
                  take host.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <p className={confirmStyles.message}>
                Your seat becomes an AI officer. Pick who takes host — they will
                run AI turns. The sector becomes unrated.
              </p>
              <label className="sr-only" htmlFor="host-leave-new-host">
                New host
              </label>
              <select
                id="host-leave-new-host"
                className={modStyles.select}
                value={newHostId}
                disabled={busy}
                onChange={(event) => setNewHostId(event.target.value)}
              >
                {transferCandidates.map((captain) => (
                  <option key={captain.id} value={captain.id}>
                    {captain.displayName}
                  </option>
                ))}
              </select>
              <label className="sr-only" htmlFor="host-leave-skill">
                AI skill for your seat
              </label>
              <select
                id="host-leave-skill"
                className={modStyles.select}
                value={skill}
                disabled={busy}
                onChange={(event) =>
                  setSkill(event.target.value as WarpSkillLevel)
                }
              >
                {SKILL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    My seat → {formatAiSkillUnratedLabel(level)}
                  </option>
                ))}
              </select>
              <div className={dialogStyles.actions}>
                <button
                  type="button"
                  className={confirmStyles.cancelBtn}
                  disabled={busy}
                  onClick={() => setMode('menu')}
                >
                  Back
                </button>
                <button
                  type="button"
                  className={confirmStyles.confirmBtn}
                  disabled={busy || !newHostId || !onLeaveWithAi}
                  onClick={() => {
                    if (!onLeaveWithAi || !newHostId) {
                      return;
                    }
                    void onLeaveWithAi({ newHostId, skill });
                  }}
                >
                  Leave &amp; continue
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
