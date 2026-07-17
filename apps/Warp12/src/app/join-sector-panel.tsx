import { Link } from 'react-router-dom';

import { DEFAULT_GAME_OBJECTIVE, GAME_OBJECTIVE_LABELS } from 'warp12-engine';

import type { FirestoreGameDocument } from '../firebase';
import { ONLINE_MAX_PLAYERS } from '../firebase';
import { ObjectiveSummary } from './objective-picker';
import styles from './lobby.module.scss';

export interface JoinSectorPanelProps {
  sectorCode: string;
  lobby: FirestoreGameDocument;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onJoin: () => void;
  onSpectate?: () => void;
  busy: boolean;
  error: string | null;
  notice: string | null;
  firebaseReady: boolean;
  firebaseConfigured: boolean;
}

/** Call sign + join for visitors who open a sector link before boarding. */
export function JoinSectorPanel({
  sectorCode,
  lobby,
  displayName,
  onDisplayNameChange,
  onJoin,
  onSpectate,
  busy,
  error,
  notice,
  firebaseReady,
  firebaseConfigured,
}: JoinSectorPanelProps) {
  const maxPlayers = lobby.maxPlayers ?? ONLINE_MAX_PLAYERS;
  const objective = lobby.objective ?? DEFAULT_GAME_OBJECTIVE;
  const atCapacity = lobby.captains.length >= maxPlayers;
  const allowSpectate = lobby.allowSpectate !== false;
  const canJoin =
    !atCapacity &&
    firebaseReady &&
    firebaseConfigured &&
    displayName.trim().length > 0 &&
    !busy;
  const canSpectate =
    allowSpectate &&
    Boolean(onSpectate) &&
    firebaseReady &&
    firebaseConfigured &&
    !busy;

  return (
    <section className={`${styles.waitingRoom} ${styles.lobbyWide}`}>
      <p className={styles.backLink}>
        <Link to="/">← Back to bridge</Link>
      </p>
      <h2 className={styles.title}>Join sector {sectorCode}</h2>
      <p className={styles.subtitle}>
        {lobby.captains.length}/{maxPlayers} captains aboard ·{' '}
        {GAME_OBJECTIVE_LABELS[objective]}
      </p>
      <p className={styles.code}>{sectorCode}</p>

      <ul className={styles.captainList}>
        {lobby.captains.map((captain) => (
          <li key={captain.id} className={styles.captainRow}>
            <span>
              {captain.displayName}
              {captain.id === lobby.hostId ? ' · Host' : ''}
            </span>
          </li>
        ))}
      </ul>

      <ObjectiveSummary objective={objective} />

      {!firebaseConfigured && (
        <p className={styles.notice}>
          Firebase is not configured — multiplayer is unavailable in this build.
        </p>
      )}

      {atCapacity ? (
        <p className={styles.notice} role="status">
          This sector is at fleet capacity. Wait for the host to make room or
          try another code.
        </p>
      ) : (
        <>
          <label className={styles.field}>
            <span>Your call sign</span>
            <input
              type="text"
              value={displayName}
              maxLength={24}
              autoFocus
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Captain name"
            />
          </label>
          <p className={styles.subtitle}>
            Choose a name to board this waiting room.
          </p>
        </>
      )}

      {!allowSpectate && atCapacity ? (
        <p className={styles.notice} role="status">
          Spectator gallery is closed for this sector.
        </p>
      ) : null}

      {!allowSpectate && !atCapacity && !canSpectate ? (
        <p className={styles.notice} role="status">
          Spectating is disabled by the host. Join as a captain, or ask them to
          reopen the gallery.
        </p>
      ) : null}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      {!atCapacity && (
        <button
          type="button"
          className={styles.primary}
          disabled={!canJoin}
          onClick={onJoin}
        >
          Join sector
        </button>
      )}

      {canSpectate ? (
        <button
          type="button"
          className={styles.secondary}
          disabled={!canSpectate}
          onClick={onSpectate}
        >
          Spectate
        </button>
      ) : null}

      <p className={styles.backLink}>
        <Link to="/online">← Fleet muster</Link>
      </p>
    </section>
  );
}

export interface SectorUnavailablePanelProps {
  sectorCode: string;
  message: string;
  onSpectate?: () => void;
  spectateAvailable?: boolean;
  busy?: boolean;
}

export function SectorUnavailablePanel({
  sectorCode,
  message,
  onSpectate,
  spectateAvailable = false,
  busy = false,
}: SectorUnavailablePanelProps) {
  return (
    <section className={`${styles.waitingRoom} ${styles.lobbyWide}`}>
      <p className={styles.backLink}>
        <Link to="/">← Back to bridge</Link>
      </p>
      <h2 className={styles.title}>Sector {sectorCode}</h2>
      <p className={styles.subtitle}>{message}</p>
      {spectateAvailable && onSpectate ? (
        <button
          type="button"
          className={styles.primary}
          disabled={busy}
          onClick={onSpectate}
        >
          Spectate this sector
        </button>
      ) : (
        <p className={styles.notice} role="status">
          Spectating is unavailable for this sector (gallery closed or
          capacity reached).
        </p>
      )}
      <p className={styles.backLink}>
        <Link to="/online">← Fleet muster</Link>
      </p>
    </section>
  );
}
