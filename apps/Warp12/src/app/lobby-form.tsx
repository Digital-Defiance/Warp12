import { DEFAULT_CAMPAIGN_ROUNDS, DEFAULT_GAME_OBJECTIVE, type GameObjective } from 'warp12-engine';

import type { CreateLobbyOptions } from '../firebase';
import { clampOnlineMaxPlayers } from '../firebase';
import {
  LOCAL_MAX_PLAYERS,
  LOCAL_MIN_PLAYERS,
} from '../game/local-game-config.js';
import { CampaignRoundsField, ObjectivePicker } from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { SubspaceFractureOptions } from './subspace-fracture-options';
import styles from './lobby.module.scss';

interface LobbyProps {
  gameCode: string;
  onGameCodeChange: (code: string) => void;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  createOptions: CreateLobbyOptions;
  onCreateOptionsChange: (options: CreateLobbyOptions) => void;
  onCreate: () => void;
  onJoin: () => void;
  busy: boolean;
  error: string | null;
  firebaseReady: boolean;
  firebaseConfigured: boolean;
}

export function LobbyForm({
  gameCode,
  onGameCodeChange,
  displayName,
  onDisplayNameChange,
  createOptions,
  onCreateOptionsChange,
  onCreate,
  onJoin,
  busy,
  error,
  firebaseReady,
  firebaseConfigured,
}: LobbyProps) {
  const setObjective = (objective: GameObjective) =>
    onCreateOptionsChange({ ...createOptions, objective });

  const setCampaignRounds = (campaignRounds: number) =>
    onCreateOptionsChange({ ...createOptions, campaignRounds });

  const setMaxPlayers = (maxPlayers: number) =>
    onCreateOptionsChange({
      ...createOptions,
      maxPlayers: clampOnlineMaxPlayers(maxPlayers),
    });

  const setModules = (patch: Partial<NonNullable<CreateLobbyOptions['modules']>>) =>
    onCreateOptionsChange({
      ...createOptions,
      modules: { ...createOptions.modules!, ...patch },
    });

  const trimmedCode = gameCode.trim();
  const joiningExisting = trimmedCode.length > 0;
  const canJoin = trimmedCode.length >= 4;
  const baseDisabled =
    busy || !firebaseReady || !firebaseConfigured || !displayName.trim();

  return (
    <section className={`${styles.lobby} ${styles.lobbyWide}`}>
      <h2 className={styles.title}>Fleet muster</h2>
      <p className={styles.subtitle}>
        Open a sector for up to eight captains, or join with a sector code.
      </p>

      {!firebaseConfigured && (
        <p className={styles.notice}>
          Firebase is not configured — copy{' '}
          <code>apps/Warp12/.env.example</code> to <code>.env</code> with your
          warp-12 project credentials to enable multiplayer.
        </p>
      )}

      <label className={styles.field}>
        <span>Call sign</span>
        <input
          type="text"
          value={displayName}
          maxLength={24}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Captain name"
        />
      </label>

      <ObjectivePicker
        name="online-objective"
        value={createOptions.objective ?? DEFAULT_GAME_OBJECTIVE}
        onChange={setObjective}
      />

      {(createOptions.objective ?? DEFAULT_GAME_OBJECTIVE) === 'points' && (
        <fieldset className={styles.fieldset}>
          <legend>Campaign length</legend>
          <CampaignRoundsField
            value={createOptions.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS}
            onChange={setCampaignRounds}
          />
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Host sector settings</legend>
        <label className={styles.field}>
          <span>
            Fleet capacity ({LOCAL_MIN_PLAYERS}–{LOCAL_MAX_PLAYERS} captains)
          </span>
          <select
            aria-label="Fleet capacity"
            value={createOptions.maxPlayers ?? LOCAL_MAX_PLAYERS}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {Array.from(
              { length: LOCAL_MAX_PLAYERS - LOCAL_MIN_PLAYERS + 1 },
              (_, index) => LOCAL_MIN_PLAYERS + index
            ).map((count) => (
              <option key={count} value={count}>
                {count} captains max
              </option>
            ))}
          </select>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.salamanderPenalty ?? true}
            onChange={(e) =>
              setModules({ salamanderPenalty: e.target.checked })
            }
          />
          <span>Module Beta — Salamander penalty</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.qContinuum ?? false}
            onChange={(e) => setModules({ qContinuum: e.target.checked })}
          />
          <span>Module Alpha — Q-Continuum</span>
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Game options</legend>
        <SubspaceFractureOptions
          enabled={createOptions.modules?.subspaceFracture ?? false}
          scope={createOptions.modules?.subspaceFractureScope ?? 'own-trail'}
          onEnabledChange={(enabled) => setModules({ subspaceFracture: enabled })}
          onScopeChange={(scope) =>
            setModules({ subspaceFractureScope: scope })
          }
        />
        <HouseRulesOptions
          value={createOptions.houseRules ?? {}}
          onChange={(patch) =>
            onCreateOptionsChange({
              ...createOptions,
              houseRules: { ...createOptions.houseRules, ...patch },
            })
          }
        />
      </fieldset>

      <label className={styles.field}>
        <span>Sector code (to join an existing sector)</span>
        <input
          type="text"
          value={gameCode}
          maxLength={6}
          onChange={(e) => onGameCodeChange(e.target.value.toUpperCase())}
          placeholder="ABC123"
        />
      </label>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className={joiningExisting ? styles.secondary : styles.primary}
          disabled={baseDisabled || joiningExisting}
          onClick={onCreate}
        >
          Open sector
        </button>
        <button
          type="button"
          className={joiningExisting ? styles.primary : styles.secondary}
          disabled={baseDisabled || !canJoin}
          onClick={onJoin}
        >
          Join sector
        </button>
      </div>
    </section>
  );
}
