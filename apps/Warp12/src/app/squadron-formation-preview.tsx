import { useEffect, useMemo, useState } from 'react';
import {
  formSquadrons,
  reconcileSquadronRosters,
} from 'warp12-engine';
import type { FirestoreCaptain } from '../firebase';
import styles from './lobby.module.scss';

const SQUAD_COLOR_CLASS = ['squadColor1', 'squadColor2', 'squadColor3'] as const;

export interface SquadronFormationPreviewProps {
  captains: readonly FirestoreCaptain[];
  squadronSize: number;
  /** Host-chosen squad names, index-aligned with formation order. */
  squadronNames?: readonly string[];
  /** Host-assigned membership; omitted = auto round-robin preview. */
  squadronRosters?: readonly (readonly string[])[];
  disabled?: boolean;
  onSquadronSizeChange: (squadronSize: number) => void;
  /** Called with the full names array (sparse entries allowed) on any edit. */
  onSquadronNamesChange: (squadronNames: readonly string[]) => void;
  /** Persist drag-roster assignments (exact squadronSize × N squads). */
  onSquadronRostersChange: (squadronRosters: readonly (readonly string[])[]) => void;
}

/**
 * Module Zeta: preview + host assignment for squadron membership.
 * Drag a captain onto another to swap seats; names label each squad.
 * Auto-reconciles when the lobby roster changes so stale ids drop out.
 */
export function SquadronFormationPreview({
  captains,
  squadronSize,
  squadronNames = [],
  squadronRosters,
  disabled = false,
  onSquadronSizeChange,
  onSquadronNamesChange,
  onSquadronRostersChange,
}: SquadronFormationPreviewProps) {
  const captainIds = useMemo(() => captains.map((c) => c.id), [captains]);

  const preview = useMemo(() => {
    if (captains.length < squadronSize * 2) {
      return {
        error: `Need at least ${squadronSize * 2} captains for ${squadronSize}-per-squad play (have ${captains.length}).`,
        squads: null as null | {
          id: string;
          memberIds: readonly string[];
          members: FirestoreCaptain[];
        }[],
      };
    }
    if (captains.length % squadronSize !== 0) {
      return {
        error: `Fleet of ${captains.length} does not divide evenly into squads of ${squadronSize}.`,
        squads: null,
      };
    }
    try {
      const { squadrons } = formSquadrons(
        captainIds,
        squadronSize,
        squadronNames,
        squadronRosters
      );
      const byId = new Map(captains.map((c) => [c.id, c] as const));
      return {
        error: null,
        squads: squadrons.map((squad) => ({
          id: squad.id,
          memberIds: squad.memberIds,
          members: squad.memberIds.map((id) => byId.get(id)!),
        })),
      };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Cannot form squads with this roster.',
        squads: null,
      };
    }
  }, [captains, captainIds, squadronSize, squadronNames, squadronRosters]);

  // When lobby membership/size drifts, rewrite assignments so launch stays valid.
  const captainKey = captainIds.join('\0');
  const rosterKey = squadronRosters?.map((r) => r.join(',')).join('|') ?? '';
  useEffect(() => {
    const next = reconcileSquadronRosters(
      captainIds,
      squadronSize,
      squadronRosters
    );
    if (!next) {
      return;
    }
    const same =
      squadronRosters &&
      squadronRosters.length === next.length &&
      squadronRosters.every(
        (row, i) =>
          row.length === next[i].length &&
          row.every((id, j) => id === next[i][j])
      );
    if (!same) {
      onSquadronRostersChange(next);
    }
    // Intentionally omit onSquadronRostersChange — parent lambdas are unstable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [captainKey, squadronSize, rosterKey]);

  const handleNameChange = (index: number, value: string) => {
    const next = [...squadronNames];
    next[index] = value;
    onSquadronNamesChange(next);
  };

  const [dragCaptainId, setDragCaptainId] = useState<string | null>(null);

  const swapCaptains = (fromId: string, toId: string) => {
    if (disabled || fromId === toId || !preview.squads) {
      return;
    }
    const rosters = preview.squads.map((s) => [...s.memberIds]);
    let fromSquad = -1;
    let fromSlot = -1;
    let toSquad = -1;
    let toSlot = -1;
    for (let s = 0; s < rosters.length; s += 1) {
      const fi = rosters[s].indexOf(fromId);
      if (fi >= 0) {
        fromSquad = s;
        fromSlot = fi;
      }
      const ti = rosters[s].indexOf(toId);
      if (ti >= 0) {
        toSquad = s;
        toSlot = ti;
      }
    }
    if (fromSquad < 0 || toSquad < 0) {
      return;
    }
    const tmp = rosters[fromSquad][fromSlot];
    rosters[fromSquad][fromSlot] = rosters[toSquad][toSlot];
    rosters[toSquad][toSlot] = tmp;
    onSquadronRostersChange(rosters);
  };

  return (
    <div className={styles.squadronPreview}>
      <label className={styles.field}>
        <span>Squadron size</span>
        <select
          aria-label="Squadron size"
          value={squadronSize}
          disabled={disabled}
          onChange={(e) => onSquadronSizeChange(Number(e.target.value))}
        >
          <option value={2}>2 captains per squad</option>
          <option value={3}>3 captains per squad</option>
        </select>
      </label>

      {preview.error ? (
        <p className={styles.squadronPreviewHint}>{preview.error}</p>
      ) : (
        <>
          <p className={styles.squadronPreviewHint}>
            Drag captains between squads to set tonight&apos;s roster. Bridge
            seating still alternates crews at the table.
          </p>
          <ul className={styles.squadronList}>
            {preview.squads!.map((squad, index) => (
              <li
                key={squad.id}
                className={`${styles.squadronRow} ${styles[SQUAD_COLOR_CLASS[index % SQUAD_COLOR_CLASS.length]]}`}
              >
                <div className={styles.squadronRowHeader}>
                  <input
                    type="text"
                    className={styles.squadronNameInput}
                    aria-label={`Squad ${index + 1} name`}
                    placeholder={`Squad ${index + 1}`}
                    maxLength={24}
                    disabled={disabled}
                    value={squadronNames[index] ?? ''}
                    onChange={(e) => handleNameChange(index, e.target.value)}
                  />
                  <ul className={styles.squadronMemberChips}>
                    {squad.members.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={styles.squadronMemberChip}
                          draggable={!disabled}
                          disabled={disabled}
                          aria-label={`Captain ${c.displayName}`}
                          onDragStart={() => setDragCaptainId(c.id)}
                          onDragEnd={() => setDragCaptainId(null)}
                          onDragOver={(e) => {
                            if (!disabled) {
                              e.preventDefault();
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragCaptainId) {
                              swapCaptains(dragCaptainId, c.id);
                            }
                            setDragCaptainId(null);
                          }}
                        >
                          {c.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Illustrative only: shows that this squad's captains will
                    chart onto one shared trail, not one each (Model C). */}
                <div
                  className={styles.sharedTrailDiagram}
                  role="img"
                  aria-label={`${squad.members.length} captains share one warp trail`}
                >
                  {squad.members.map((m) => (
                    <span
                      key={m.id}
                      className={styles.sharedTrailNode}
                      title={m.displayName}
                    />
                  ))}
                  <span className={styles.sharedTrailLine} />
                  <span className={styles.sharedTrailLabel}>shared trail</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
