import { defaultCampaignRounds, DEFAULT_GAME_OBJECTIVE, type GameObjective } from 'warp12-engine';

import type { CreateLobbyOptions } from '../firebase';
import type { PublicCharterView } from '../firebase/charter-service.js';
import { clampOnlineMaxPlayers } from '../firebase';
import { lobbyOptionsFromCharter } from '../game/charter-lobby.js';
import { warp12OfficialCreateLobbyOptions } from '../game/warp12-preset.js';
import {
  LOCAL_MAX_PLAYERS,
  LOCAL_MIN_PLAYERS,
  maxPlayersForFactor,
} from '../game/local-game-config.js';
import { requireWarpFactor } from './warp-factor.js';
import { CampaignRoundsField, ObjectivePicker } from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { DoubleZeroScoreField } from './double-zero-score-field';
import { LargeFleetHandSizeField } from './large-fleet-hand-size-field';
import {
  DealHandSizeHint,
  isLargeFleetHandSizeChoiceVisible,
} from './deal-hand-size-hint';
import { SubspaceFractureOptions } from './subspace-fracture-options';
import { Warp12RulesPreset } from './warp12-rules-preset';
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
  myCharters?: PublicCharterView[];
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
  myCharters = [],
}: LobbyProps) {
  const fleetMax = maxPlayersForFactor(requireWarpFactor());
  const fleetCeiling = Math.min(LOCAL_MAX_PLAYERS, fleetMax);
  const maxPip = requireWarpFactor();
  const exhibitionSet = maxPip !== 12;
  const charterLocked = Boolean(createOptions.charterId);
  const activeCharter =
    myCharters.find((crew) => crew.charterId === createOptions.charterId) ?? null;
  const setObjective = (objective: GameObjective) =>
    onCreateOptionsChange({ ...createOptions, objective });

  const setCampaignRounds = (campaignRounds: number) =>
    onCreateOptionsChange({ ...createOptions, campaignRounds });

  const setMaxPlayers = (maxPlayers: number) =>
    onCreateOptionsChange({
      ...createOptions,
      maxPlayers: clampOnlineMaxPlayers(maxPlayers, fleetCeiling),
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

  const applyOfficialWarp12Rules = () =>
    onCreateOptionsChange(
      warp12OfficialCreateLobbyOptions({
        maxPlayers: createOptions.maxPlayers,
      })
    );

  return (
    <section className={`${styles.lobby} ${styles.lobbyWide}`}>
      <h2 className={styles.title}>Fleet muster</h2>
      <p className={styles.subtitle}>
        Open a sector for up to {fleetCeiling} captains, or join with a sector
        code.
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

      {myCharters.length > 0 && (
        <label className={styles.field}>
          <span>Quick setup from crew</span>
          <select
            aria-label="Crew quick setup"
            value={createOptions.charterId ?? ''}
            disabled={baseDisabled}
            onChange={(e) => {
              const crewId = e.target.value;
              if (!crewId) {
                onCreateOptionsChange({
                  ...createOptions,
                  charterId: undefined,
                  rulesProfileId: undefined,
                });
                return;
              }
              const crew = myCharters.find((row) => row.charterId === crewId);
              if (!crew) {
                return;
              }
              onCreateOptionsChange(lobbyOptionsFromCharter(crew, createOptions));
            }}
          >
            <option value="">Custom sector settings</option>
            {myCharters.map((crew) => (
              <option key={crew.charterId} value={crew.charterId}>
                {crew.name} ({crew.playerCount}p ·{' '}
                {crew.objective === 'go-out' ? 'go-out' : 'points'})
              </option>
            ))}
          </select>
        </label>
      )}

      {activeCharter && (
        <p className={styles.notice} role="status">
          Crew charter: {activeCharter.name} — lobby settings locked to match
          your crew rules.
        </p>
      )}

      <ObjectivePicker
        name="online-objective"
        value={createOptions.objective ?? DEFAULT_GAME_OBJECTIVE}
        onChange={setObjective}
        disabled={baseDisabled || charterLocked}
      />

      {(createOptions.objective ?? DEFAULT_GAME_OBJECTIVE) === 'points' && (
        <fieldset className={styles.fieldset}>
          <legend>Campaign length</legend>
          <CampaignRoundsField
            value={createOptions.campaignRounds ?? defaultCampaignRounds(maxPip)}
            onChange={setCampaignRounds}
            disabled={baseDisabled || charterLocked}
            maxPip={maxPip}
          />
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Rules preset</legend>
        <Warp12RulesPreset
          maxPip={maxPip}
          onApply={applyOfficialWarp12Rules}
          disabled={baseDisabled || charterLocked}
        />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Host sector settings</legend>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={!exhibitionSet && (createOptions.rated ?? true)}
            disabled={baseDisabled || charterLocked || exhibitionSet}
            onChange={(e) =>
              onCreateOptionsChange({ ...createOptions, rated: e.target.checked })
            }
          />
          <span>
            {exhibitionSet
              ? `Exhibition set (Warp ${maxPip}) — TEI is Warp 12 only. This sector stays unrated.`
              : 'Rated sector — results count toward TEI. Comms are limited to quick hails during play. Uncheck for a casual game with open chat.'}
          </span>
        </label>
        <label className={styles.field}>
          <span>
            Fleet capacity ({LOCAL_MIN_PLAYERS}–{fleetCeiling} captains)
          </span>
          <select
            aria-label="Fleet capacity"
            value={Math.min(
              createOptions.maxPlayers ?? fleetCeiling,
              fleetCeiling
            )}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          >
            {Array.from(
              { length: fleetCeiling - LOCAL_MIN_PLAYERS + 1 },
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
            checked={createOptions.modules?.continuum ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ continuum: e.target.checked })}
          />
          <span>Module Alpha — Continuum</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.salamanderPenalty ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) =>
              setModules({ salamanderPenalty: e.target.checked })
            }
          />
          <span>Module Beta — Salamander penalty</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.sensorGrid ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ sensorGrid: e.target.checked })}
          />
          <span>Module Gamma — Long-Range Sensor Sweep</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.warpDriveSpool ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ warpDriveSpool: e.target.checked })}
          />
          <span>Module Delta — Hot Potato (Warp Drive Spool)</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.longestTrail ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ longestTrail: e.target.checked })}
          />
          <span>Module Theta — Longest Trail Bonus</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.doubleDown ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ doubleDown: e.target.checked })}
          />
          <span>Module Iota — Double Down</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.temporalDebt ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ temporalDebt: e.target.checked })}
          />
          <span>Module Eta — Temporal Debt</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.drafting ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ drafting: e.target.checked })}
          />
          <span>Module Epsilon — Tactical Requisition (Drafting)</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.temporalInversion ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ temporalInversion: e.target.checked })}
          />
          <span>Module Kappa — Temporal Inversion (Warped/Exhibition)</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={createOptions.modules?.wormholes ?? false}
            disabled={baseDisabled || charterLocked}
            onChange={(e) => setModules({ wormholes: e.target.checked })}
          />
          <span>Module Lambda — Wormholes (Warped/Exhibition)</span>
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Game options</legend>
        <DoubleZeroScoreField
          value={createOptions.houseRules?.doubleZeroScore}
          disabled={baseDisabled || charterLocked}
          onChange={(doubleZeroScore) =>
            onCreateOptionsChange({
              ...createOptions,
              houseRules: { ...createOptions.houseRules, doubleZeroScore },
            })
          }
        />
        <DealHandSizeHint
          playerCount={createOptions.maxPlayers ?? fleetCeiling}
          maxPip={maxPip}
          largeFleetHandSize={createOptions.houseRules?.largeFleetHandSize}
        />
        {isLargeFleetHandSizeChoiceVisible(
          createOptions.maxPlayers ?? fleetCeiling
        ) && (
          <LargeFleetHandSizeField
            value={createOptions.houseRules?.largeFleetHandSize}
            disabled={baseDisabled || charterLocked}
            onChange={(largeFleetHandSize) =>
              onCreateOptionsChange({
                ...createOptions,
                houseRules: {
                  ...createOptions.houseRules,
                  largeFleetHandSize,
                },
              })
            }
          />
        )}
        <SubspaceFractureOptions
          enabled={createOptions.modules?.subspaceFracture ?? false}
          scope={createOptions.modules?.subspaceFractureScope ?? 'own-trail'}
          disabled={baseDisabled || charterLocked}
          onEnabledChange={(enabled) => setModules({ subspaceFracture: enabled })}
          onScopeChange={(scope) =>
            setModules({ subspaceFractureScope: scope })
          }
        />
        <HouseRulesOptions
          value={createOptions.houseRules ?? {}}
          disabled={baseDisabled || charterLocked}
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
