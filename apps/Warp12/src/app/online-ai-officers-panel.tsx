import { formatAiSkillUnratedLabel, type WarpSkillLevel } from 'warp12-engine';

import {
  addAiCaptain,
  ONLINE_MAX_PLAYERS,
  updateAiCaptain,
  type FirestoreCaptain,
  type FirestoreGameDocument,
} from '../firebase';
import { isAiCaptain, pickNextAiOfficer } from '../game/ai-captain.js';
import { neuralAiSupported } from '../game/local-game-config.js';
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
  const maxPip = lobby.maxPip ?? 12;
  const exhibitionSet = !neuralAiSupported(maxPip);

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
      speakAs?: string | null;
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
        it is their turn. Spoken-as aliases feed commentary TTS only — call
        signs stay on the table. Fleet-wide IPA rules live in the Ops ElevenLabs
        pronunciation dictionary.
        {seatsOpen > 0
          ? ` ${seatsOpen} seat${seatsOpen === 1 ? '' : 's'} open.`
          : ' Fleet is at capacity.'}
      </p>
      {exhibitionSet ? (
        <p className={styles.notice} role="status">
          Exhibition set — Commander seats use heuristics only until neural
          weights ship for this factor (Warp 12 has Ω today).
        </p>
      ) : null}
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
          <input
            className={styles.aiNameInput}
            aria-label={`${captain.displayName} spoken as`}
            defaultValue={captain.speakAs ?? ''}
            key={`${captain.id}:speakAs:${captain.speakAs ?? ''}`}
            placeholder="Spoken as (TTS)"
            disabled={busy}
            onBlur={(event) => {
              const next = event.target.value.trim();
              const prev = captain.speakAs ?? '';
              if (next !== prev) {
                void patchCaptain(captain, { speakAs: next || null });
              }
            }}
          />
          <select
            aria-label={`${captain.displayName} commission track`}
            value={captain.skill ?? 'lieutenant'}
            disabled={busy}
            onChange={(event) =>
              void patchCaptain(captain, {
                skill: event.target.value as WarpSkillLevel,
              })
            }
          >
            <option value="ensign">
              {formatAiSkillUnratedLabel('ensign')}
            </option>
            <option value="lieutenant">
              {formatAiSkillUnratedLabel('lieutenant')}
            </option>
            <option value="commander">
              {exhibitionSet
                ? `${formatAiSkillUnratedLabel('commander')} · heuristics`
                : formatAiSkillUnratedLabel('commander')}
            </option>
          </select>
        </div>
      ))}
    </fieldset>
  );
}

export default OnlineAiOfficersPanel;
