import type { WarpSkillLevel } from 'warp12-engine';

import {
  addAiCaptain,
  ONLINE_MAX_PLAYERS,
  updateAiCaptain,
  type FirestoreCaptain,
  type FirestoreGameDocument,
} from '../firebase';
import { isAiCaptain, pickNextAiOfficer } from '../game/ai-captain.js';
import styles from './lobby.module.scss';

interface OnlineAiOfficersPanelProps {
  lobby: FirestoreGameDocument;
  busy: boolean;
  hostId: string;
  uid: string;
  onBusy: (busy: boolean) => void;
  onError: (message: string) => void;
}

export function OnlineAiOfficersPanel({
  lobby,
  busy,
  hostId,
  uid,
  onBusy,
  onError,
}: OnlineAiOfficersPanelProps) {
  const aiCaptains = lobby.captains.filter((captain) => isAiCaptain(captain));
  const maxPlayers = lobby.maxPlayers ?? ONLINE_MAX_PLAYERS;
  const seatsOpen = maxPlayers - lobby.captains.length;
  const nextOfficer = pickNextAiOfficer(lobby.captains);
  const canAdd = seatsOpen > 0 && nextOfficer != null;

  const addOfficer = async () => {
    if (!uid || uid !== hostId || !canAdd) {
      return;
    }
    onBusy(true);
    try {
      await addAiCaptain(lobby.id, uid);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add AI officer');
    } finally {
      onBusy(false);
    }
  };

  const patchCaptain = async (
    captain: FirestoreCaptain,
    patch: {
      displayName?: string;
      skill?: WarpSkillLevel;
    }
  ) => {
    if (!uid || uid !== hostId) {
      return;
    }
    onBusy(true);
    try {
      await updateAiCaptain(lobby.id, uid, captain.id, patch);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : 'Could not update AI officer'
      );
    } finally {
      onBusy(false);
    }
  };

  return (
    <fieldset className={styles.fieldset}>
      <legend>AI officers ({aiCaptains.length})</legend>
      <p className={styles.subtitle}>
        Fill empty seats with host-run officers. They chart on your bridge when
        it is their turn.
        {seatsOpen > 0
          ? ` ${seatsOpen} seat${seatsOpen === 1 ? '' : 's'} open.`
          : ' Fleet is at capacity.'}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || !canAdd}
          onClick={() => void addOfficer()}
        >
          {nextOfficer
            ? `Add AI officer (${nextOfficer.displayName})`
            : 'Add AI officer'}
        </button>
      </div>
      {aiCaptains.map((captain) => (
        <div key={captain.id} className={styles.aiRow}>
          <input
            className={styles.aiNameInput}
            aria-label={`${captain.displayName} call sign`}
            defaultValue={captain.displayName}
            key={`${captain.id}:${captain.displayName}`}
            disabled={busy}
            onBlur={(event) => {
              const next = event.target.value.trim();
              if (next && next !== captain.displayName) {
                void patchCaptain(captain, { displayName: next });
              }
            }}
          />
          <select
            aria-label={`${captain.displayName} skill level`}
            value={captain.skill ?? 'intermediate'}
            disabled={busy}
            onChange={(event) =>
              void patchCaptain(captain, {
                skill: event.target.value as WarpSkillLevel,
              })
            }
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      ))}
    </fieldset>
  );
}

export default OnlineAiOfficersPanel;
