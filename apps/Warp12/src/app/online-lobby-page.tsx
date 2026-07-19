import { goOutAwareModuleLabel } from './go-out-module-labels.js';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_GAME_OBJECTIVE,
  GAME_OBJECTIVE_LABELS,
  defaultCampaignRounds,
  hasWarpedModules,
  isModuleAvailableForObjective,
  moduleClearPatchForObjective,
  sanitizeModuleConfigForObjective,
  type GameObjective,
} from 'warp12-engine';

import {
  clampOnlineMaxPlayers,
  createLobby,
  dissolveLobby,
  generateGameCode,
  joinLobby,
  kickCaptain,
  launchOnlineGame,
  leaveLobby,
  ONLINE_MAX_PLAYERS,
  ONLINE_MIN_PLAYERS,
  subscribeLobby,
  updateLobbySettings,
  useFirebaseAuth,
  type CreateLobbyOptions,
  type FirestoreGameDocument,
} from '../firebase';
import { LobbyForm } from './lobby-form';
import { OnlineAiOfficersPanel } from './online-ai-officers-panel';
import {
  JoinSectorPanel,
  SectorUnavailablePanel,
} from './join-sector-panel';
import { joinSpectate } from '../firebase/spectate-service.js';
import {
  CampaignRoundsField,
  GoOutCampaignField,
  MatchStarterPicker,
  ObjectivePicker,
  ObjectiveSummary,
  type GoOutCampaignConfig,
} from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { DoubleZeroScoreField } from './double-zero-score-field';
import { LargeFleetHandSizeField } from './large-fleet-hand-size-field';
import {
  DealHandSizeHint,
  isLargeFleetHandSizeChoiceVisible,
} from './deal-hand-size-hint';
import { SubspaceFractureOptions } from './subspace-fracture-options';
import { SquadronFormationPreview } from './squadron-formation-preview';
import { Warp12RulesPreset } from './warp12-rules-preset';
import { isAiCaptain } from '../game/ai-captain.js';
import {
  onlineMatchRatingEligibility,
  onlineRatingWarning,
} from '../firebase/human-tei.js';
import {
  listMyCharters,
  type PublicCharterView,
} from '../firebase/charter-service.js';
import {
  lobbyOptionsFromCharter,
} from '../game/charter-lobby.js';
import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
  warp12OfficialCreateLobbyOptions,
} from '../game/warp12-preset.js';
import {
  createLobbyOptionsToPreset,
  presetToCreateLobbyOptions,
  resolveLastUsedPreset,
  writeLastUsedPreset,
} from '../game/setup-presets.js';
import { maxPlayersForFactor } from '../game/local-game-config.js';
import { copyTextToClipboard } from '../game/deliver-file.js';
import { sectorInviteLinks } from '../game/sector-invite-urls.js';
import styles from './lobby.module.scss';
import { requireWarpFactor } from './warp-factor.js';

const DEFAULT_CREATE_OPTIONS = warp12OfficialCreateLobbyOptions({
  maxPip: requireWarpFactor(),
});

export function OnlineLobbyPage() {
  const { gameId: routeGameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useFirebaseAuth();
  const createMaxPip = requireWarpFactor();

  const [initialOnlinePreset] = useState(() =>
    resolveLastUsedPreset('online')
  );
  const [gameCode, setGameCode] = useState(routeGameId?.toUpperCase() ?? '');
  const [displayName, setDisplayName] = useState(
    () => initialOnlinePreset?.callSign ?? ''
  );
  const [createOptions, setCreateOptions] = useState<CreateLobbyOptions>(() => {
    if (!initialOnlinePreset) {
      return DEFAULT_CREATE_OPTIONS;
    }
    const applied = presetToCreateLobbyOptions(
      initialOnlinePreset,
      createMaxPip,
      DEFAULT_CREATE_OPTIONS
    );
    const ceiling = maxPlayersForFactor(createMaxPip);
    return {
      ...applied,
      maxPlayers: clampOnlineMaxPlayers(
        applied.maxPlayers ?? ceiling,
        ceiling
      ),
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [lobby, setLobby] = useState<FirestoreGameDocument | null>(null);
  const [lobbyLoaded, setLobbyLoaded] = useState(false);
  const [myCharters, setMyCharters] = useState<PublicCharterView[]>([]);
  const wasMemberRef = useRef(false);

  const sectorMaxPip = lobby?.maxPip ?? createMaxPip;
  const fleetCeiling = maxPlayersForFactor(sectorMaxPip);
  const uid = auth.user?.uid;
  const sectorCode = routeGameId?.toUpperCase() ?? '';
  const isMember = Boolean(uid && lobby?.captainIds.includes(uid));
  const inWaitingRoom = Boolean(sectorCode && lobby?.phase === 'lobby' && isMember);

  useEffect(() => {
    const callSignNotice = (
      location.state as { callSignNotice?: string } | null
    )?.callSignNotice;
    if (callSignNotice) {
      setNotice(callSignNotice);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!routeGameId) {
      setLobbyLoaded(false);
      setLobby(null);
    }
  }, [routeGameId]);

  useEffect(() => {
    if (!routeGameId || !auth.ready) {
      return;
    }

    setLobbyLoaded(false);
    wasMemberRef.current = false;
    return subscribeLobby(
      routeGameId.toUpperCase(),
      (doc) => {
        setLobbyLoaded(true);
        setLobby(doc);
        const member = Boolean(uid && doc?.captainIds.includes(uid));
        if (
          doc?.phase === 'active' &&
          uid &&
          member
        ) {
          navigate(`/online/${routeGameId.toUpperCase()}/play`, {
            replace: true,
          });
          return;
        }
        if (
          doc &&
          doc.phase === 'lobby' &&
          uid &&
          wasMemberRef.current &&
          !member
        ) {
          navigate('/online', {
            replace: true,
            state: { callSignNotice: 'You were removed from this sector.' },
          });
          return;
        }
        wasMemberRef.current = member;
      },
      (err) => {
        setLobbyLoaded(true);
        setError(err.message);
      }
    );
  }, [routeGameId, auth.ready, navigate, uid]);

  useEffect(() => {
    if (!auth.user || auth.user.isAnonymous) {
      setMyCharters([]);
      return;
    }
    void listMyCharters().then(setMyCharters).catch(() => setMyCharters([]));
  }, [auth.user]);

  const openSector = async () => {
    if (!uid) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const code = generateGameCode();
      await createLobby(code, uid, displayName.trim(), {
        ...createOptions,
        verified: Boolean(auth.user && !auth.user.isAnonymous),
      });
      writeLastUsedPreset(
        'online',
        createLobbyOptionsToPreset(createOptions, {
          callSign: displayName.trim(),
        })
      );
      navigate(`/online/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create sector');
    } finally {
      setBusy(false);
    }
  };

  const joinSector = async (codeOverride?: string) => {
    if (!uid) {
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const code = (codeOverride ?? gameCode).toUpperCase();
      const requested = displayName.trim();
      const { displayName: assigned } = await joinLobby(code, uid, requested, {
        verified: Boolean(auth.user && !auth.user.isAnonymous),
      });
      if (assigned !== requested) {
        setDisplayName(assigned);
        setNotice(
          `Call sign adjusted to “${assigned}” — that name is already aboard.`
        );
      }
      if (routeGameId?.toUpperCase() !== code) {
        navigate(`/online/${code}`, {
          state:
            assigned !== requested
              ? {
                  callSignNotice: `Call sign adjusted to “${assigned}” — that name is already aboard.`,
                }
              : undefined,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join sector');
    } finally {
      setBusy(false);
    }
  };

  const startSpectate = async (codeOverride?: string) => {
    if (!uid) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const code = (codeOverride ?? gameCode).toUpperCase();
      await joinSpectate(code);
      navigate(`/online/${code}/watch`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not spectate');
    } finally {
      setBusy(false);
    }
  };

  const launch = async () => {
    if (!uid || !routeGameId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await launchOnlineGame(routeGameId.toUpperCase(), uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Launch failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async (patch: {
    objective?: GameObjective;
    maxPlayers?: number;
    campaignRounds?: number;
    goOutStructure?: import('warp12-engine').GoOutStructure;
    goOutWinsToWin?: number;
    goOutOvertime?: import('warp12-engine').GoOutOvertimePolicy;
    matchStarterIndex?: number;
    modules?: CreateLobbyOptions['modules'];
    houseRules?: CreateLobbyOptions['houseRules'];
    rated?: boolean;
    allowSpectate?: boolean;
    maxPip?: number;
    charterId?: string;
    rulesProfileId?: string;
  }) => {
    if (!uid || !routeGameId || !lobby) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateLobbySettings(routeGameId.toUpperCase(), uid, patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save settings');
    } finally {
      setBusy(false);
    }
  };

  const removeCaptain = async (targetId: string) => {
    if (!uid || !routeGameId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await kickCaptain(routeGameId.toUpperCase(), uid, targetId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove captain');
    } finally {
      setBusy(false);
    }
  };

  const depart = async () => {
    if (!uid || !routeGameId) {
      navigate('/online');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (lobby?.hostId === uid) {
        await dissolveLobby(routeGameId.toUpperCase(), uid);
      } else {
        await leaveLobby(routeGameId.toUpperCase(), uid);
      }
      navigate('/online');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not leave sector');
    } finally {
      setBusy(false);
    }
  };

  if (sectorCode && !auth.ready) {
    return (
      <p className={styles.waitingMessage}>Establishing subspace IWDF link…</p>
    );
  }

  if (sectorCode && auth.ready && !auth.user) {
    return (
      <section className={`${styles.waitingRoom} ${styles.lobbyWide}`}>
        <p className={styles.backLink}>
          <Link to="/">← Back to bridge</Link>
        </p>
        <h2 className={styles.title}>Sector {sectorCode}</h2>
        <p className={styles.error} role="alert">
          Could not establish a subspace session
          {auth.error ? `: ${auth.error}` : '.'} Check your connection, then
          reload, or sign in with Google from the bridge home.
        </p>
        <p className={styles.backLink}>
          <Link to="/online">← Fleet muster</Link>
        </p>
      </section>
    );
  }

  if (sectorCode && auth.ready && !lobbyLoaded) {
    return (
      <p className={styles.waitingMessage}>Scanning sector {sectorCode}…</p>
    );
  }

  if (sectorCode && lobbyLoaded && !lobby) {
    return (
      <SectorUnavailablePanel
        sectorCode={sectorCode}
        message="No sector found with that code. Check the link or open a new one from fleet muster."
      />
    );
  }

  if (
    sectorCode &&
    lobby?.phase === 'active' &&
    uid &&
    !lobby.captainIds.includes(uid)
  ) {
    return (
      <SectorUnavailablePanel
        sectorCode={sectorCode}
        message="This mission is already underway. New captains cannot board mid-flight."
        spectateAvailable={lobby.allowSpectate !== false}
        onSpectate={() => void startSpectate(sectorCode)}
        busy={busy}
      />
    );
  }

  if (sectorCode && lobby?.phase === 'lobby' && uid && !isMember && lobby) {
    return (
      <JoinSectorPanel
        sectorCode={sectorCode}
        lobby={lobby}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        onJoin={() => void joinSector(sectorCode)}
        onSpectate={() => void startSpectate(sectorCode)}
        busy={busy}
        error={error}
        notice={notice}
        firebaseReady={auth.ready}
        firebaseConfigured={auth.configured}
      />
    );
  }

  if (inWaitingRoom && lobby) {
    const isHost = lobby.hostId === uid;
    const maxPlayers = lobby.maxPlayers ?? ONLINE_MAX_PLAYERS;
    const objective = lobby.objective ?? DEFAULT_GAME_OBJECTIVE;
    const campaignRounds = lobby.campaignRounds ?? DEFAULT_CAMPAIGN_ROUNDS;
    const charterLocked = Boolean(lobby.charterId);
    const activeCharter =
      myCharters.find((crew) => crew.charterId === lobby.charterId) ?? null;

    return (
      <section className={`${styles.waitingRoom} ${styles.lobbyWide}`}>
        <p className={styles.backLink}>
          <Link to="/">← Back to bridge</Link>
        </p>
        <h2 className={styles.title}>Sector {routeGameId?.toUpperCase()}</h2>
        <p className={styles.subtitle}>
          {lobby.captains.length}/{maxPlayers} captains aboard ·{' '}
          {GAME_OBJECTIVE_LABELS[objective]}
        </p>
        <p className={styles.code}>{routeGameId?.toUpperCase()}</p>
        <div className={styles.inviteActions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => {
              const links = sectorInviteLinks(routeGameId ?? '');
              void copyTextToClipboard(links.joinUrl)
                .then(() => {
                  setError(null);
                  setInviteStatus('Captain invite link copied.');
                })
                .catch(() =>
                  setError(
                    'Could not copy invite link — copy the sector code instead.'
                  )
                );
            }}
          >
            Copy invite link
          </button>
          <button
            type="button"
            className={styles.secondaryBtn}
            disabled={lobby.allowSpectate === false}
            onClick={() => {
              const links = sectorInviteLinks(routeGameId ?? '');
              void copyTextToClipboard(links.watchUrl)
                .then(() => {
                  setError(null);
                  setInviteStatus('Spectator link copied.');
                })
                .catch(() =>
                  setError(
                    'Could not copy spectator link — open Options mid-mission for Copy spectator link.'
                  )
                );
            }}
          >
            Copy spectator link
          </button>
        </div>
        {inviteStatus ? (
          <p className={styles.inviteStatus} role="status">
            {inviteStatus}
          </p>
        ) : null}

        {(() => {
          const eligibility = onlineMatchRatingEligibility(
            lobby.captains,
            objective,
            lobby.rated ?? true,
            lobby.maxPip ?? 12,
            lobby.modules
          );
          if (eligibility.rated) {
            return (
              <p className={styles.ratedBanner} role="status">
                ✔ Rated sector — TEI updates for every captain when the mission
                ends.
              </p>
            );
          }
          return (
            <p className={styles.unratedBanner} role="status">
              ⚠ {onlineRatingWarning(eligibility, lobby.captains)}
            </p>
          );
        })()}

        {activeCharter && (
          <p className={styles.ratedBanner} role="status">
            Crew charter: {activeCharter.name} — {activeCharter.playerCount}{' '}
            captains ·{' '}
            {activeCharter.objective === 'go-out' ? 'Go-out' : 'Points'}
            {activeCharter.isGlobalOfficial
              ? ' · also counts toward Global Official TEI'
              : ''}
          </p>
        )}

        {isHost && myCharters.length > 0 && (
          <label className={styles.field}>
            <span>Crew (optional)</span>
            <select
              aria-label="Crew charter"
              value={lobby.charterId ?? ''}
              disabled={busy}
              onChange={(e) => {
                const crewId = e.target.value;
                if (!crewId) {
                  void saveSettings({ charterId: '' });
                  return;
                }
                const crew = myCharters.find((row) => row.charterId === crewId);
                if (!crew) {
                  return;
                }
                void saveSettings(
                  lobbyOptionsFromCharter(crew, {
                    rated: lobby.rated ?? true,
                  })
                );
              }}
            >
              <option value="">No crew — global human pool</option>
              {myCharters.map((crew) => (
                <option key={crew.charterId} value={crew.charterId}>
                  {crew.name} ({crew.playerCount}p ·{' '}
                  {crew.objective === 'go-out' ? 'go-out' : 'points'})
                </option>
              ))}
            </select>
          </label>
        )}

        {isHost && (
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={
                (lobby.maxPip ?? 12) === 12 &&
                (lobby.rated ?? true) &&
                !hasWarpedModules(lobby.modules)
              }
              disabled={
                busy ||
                (lobby.maxPip ?? 12) !== 12 ||
                hasWarpedModules(lobby.modules)
              }
              onChange={(e) => void saveSettings({ rated: e.target.checked })}
            />
            <span>
              {hasWarpedModules(lobby.modules)
                ? 'Warped module aboard — exhibition only (TEI stays off).'
                : (lobby.maxPip ?? 12) === 12
                  ? 'Rated sector — count results toward TEI (quick-hail comms only; tactical advisor hidden). Uncheck for a casual game with open chat and advisor.'
                  : `Exhibition set (Warp ${lobby.maxPip}) — TEI is Warp 12 only. This sector stays unrated.`}
            </span>
          </label>
        )}

        {isHost && (
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={lobby.allowSpectate !== false}
              disabled={busy}
              onChange={(e) =>
                void saveSettings({ allowSpectate: e.target.checked })
              }
            />
            <span>
              Allow spectators — captains without a seat can watch the table
              (public subspace only; no hands). Uncheck to close the gallery.
            </span>
          </label>
        )}

        <ul className={styles.captainList}>
          {lobby.captains.map((captain) => (
            <li key={captain.id} className={styles.captainRow}>
              <span>
                {captain.displayName}
                {captain.id === lobby.hostId ? ' · Host' : ''}
                {isAiCaptain(captain) ? ' · AI' : ''}
              </span>
              {isHost && captain.id !== lobby.hostId && (
                <button
                  type="button"
                  className={styles.linkBtn}
                  disabled={busy}
                  onClick={() => void removeCaptain(captain.id)}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>

        {isHost && (
          <OnlineAiOfficersPanel
            lobby={lobby}
            busy={busy}
            hostId={lobby.hostId}
            uid={uid ?? ''}
            onBusy={setBusy}
            onError={setError}
          />
        )}

        {isHost ? (
          <ObjectivePicker
            name="waiting-objective"
            value={objective}
            disabled={busy || charterLocked}
            onChange={(value) => {
              const nextModules = sanitizeModuleConfigForObjective(
                lobby.modules,
                value
              );
              const modulesChanged =
                JSON.stringify(nextModules) !==
                JSON.stringify(lobby.modules ?? {});
              void saveSettings({
                objective: value,
                ...(modulesChanged ? { modules: nextModules } : {}),
              });
            }}
          />
        ) : (
          <ObjectiveSummary
            objective={objective}
            campaignRounds={campaignRounds}
            goOutStructure={lobby.goOutStructure}
            goOutWinsToWin={lobby.goOutWinsToWin}
          />
        )}

        {isHost && objective === 'points' && (
          <fieldset className={styles.fieldset}>
            <legend>Campaign length</legend>
            <CampaignRoundsField
              value={campaignRounds}
              disabled={busy || charterLocked}
              maxPip={sectorMaxPip}
              onChange={(value) => void saveSettings({ campaignRounds: value })}
            />
          </fieldset>
        )}

        {isHost && objective === 'go-out' && (
          <GoOutCampaignField
            name="waiting-go-out"
            value={{
              goOutStructure: lobby.goOutStructure ?? 'sudden-death',
              goOutWinsToWin: lobby.goOutWinsToWin ?? 3,
              goOutOvertime: lobby.goOutOvertime ?? 'force',
              campaignRounds,
            }}
            disabled={busy || charterLocked}
            maxPip={sectorMaxPip}
            onChange={(cfg: GoOutCampaignConfig) =>
              void saveSettings({
                goOutStructure: cfg.goOutStructure,
                goOutWinsToWin: cfg.goOutWinsToWin,
                goOutOvertime: cfg.goOutOvertime,
                campaignRounds: cfg.campaignRounds,
              })
            }
          />
        )}

        {!isHost && objective === 'go-out' && (
          <ObjectiveSummary
            objective={objective}
            campaignRounds={campaignRounds}
            goOutStructure={lobby.goOutStructure}
            goOutWinsToWin={lobby.goOutWinsToWin}
          />
        )}

        {isHost && (
          <MatchStarterPicker
            captains={lobby.captains.map((c) => ({
              id: c.id,
              displayName: c.displayName,
            }))}
            value={lobby.matchStarterIndex ?? -1}
            disabled={busy}
            onChange={(index) => void saveSettings({ matchStarterIndex: index })}
          />
        )}

        {isHost && (
          <fieldset className={styles.fieldset}>
            <legend>Mission settings</legend>
            <Warp12RulesPreset
              maxPip={sectorMaxPip}
              disabled={busy || charterLocked}
              onApply={() =>
                void saveSettings({
                  objective: WARP12_OFFICIAL_OBJECTIVE,
                  campaignRounds: defaultCampaignRounds(sectorMaxPip),
                  modules: { ...WARP12_OFFICIAL_MODULES },
                  houseRules: { ...WARP12_OFFICIAL_HOUSE_RULES },
                })
              }
            />
            <label className={styles.field}>
              <span>Fleet capacity</span>
              <select
                aria-label="Fleet capacity"
                value={Math.min(maxPlayers, fleetCeiling)}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    maxPlayers: clampOnlineMaxPlayers(
                      Number(e.target.value),
                      fleetCeiling
                    ),
                  })
                }
              >
                {Array.from(
                  { length: fleetCeiling - (ONLINE_MIN_PLAYERS + 1) + 1 },
                  (_, index) => ONLINE_MIN_PLAYERS + 1 + index
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
                checked={lobby.modules.salamanderPenalty}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      salamanderPenalty: e.target.checked,
                    },
                  })
                }
              />
              <span>{goOutAwareModuleLabel('beta', lobby.objective ?? 'points')}</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.continuum}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      continuum: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Alpha — Continuum</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.sensorGrid ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      sensorGrid: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Gamma — Long-Range Sensor Sweep</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.warpDriveSpool ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      warpDriveSpool: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Delta — Hot Potato (Warp Drive Spool)</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.longestTrail ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      longestTrail: e.target.checked,
                    },
                  })
                }
              />
              <span>{goOutAwareModuleLabel('theta', lobby.objective ?? 'points')}</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.doubleDown ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      doubleDown: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Iota — Double Down</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.temporalDebt ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      temporalDebt: e.target.checked,
                    },
                  })
                }
              />
              <span>{goOutAwareModuleLabel('eta', lobby.objective ?? 'points')}</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={
                  isModuleAvailableForObjective(
                    'drafting',
                    lobby.objective ?? DEFAULT_GAME_OBJECTIVE
                  )
                    ? (lobby.modules.drafting ?? false)
                    : false
                }
                disabled={
                  busy ||
                  charterLocked ||
                  !isModuleAvailableForObjective(
                    'drafting',
                    lobby.objective ?? DEFAULT_GAME_OBJECTIVE
                  )
                }
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      drafting: e.target.checked,
                    },
                  })
                }
              />
              <span>
                {goOutAwareModuleLabel(
                  'epsilon',
                  lobby.objective ?? DEFAULT_GAME_OBJECTIVE
                )}
              </span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.temporalInversion ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      temporalInversion: e.target.checked,
                    },
                  })
                }
              />
              <span>{goOutAwareModuleLabel('kappa', lobby.objective ?? 'points')}</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.wormholes ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      wormholes: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Lambda — Wormholes (Warped/Exhibition)</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.squadrons ?? false}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      squadrons: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Zeta — Fleet Squadrons (team play)</span>
            </label>
            {lobby.modules.squadrons && (
              <SquadronFormationPreview
                captains={lobby.captains}
                squadronSize={lobby.modules.squadronSize ?? 2}
                squadronNames={lobby.modules.squadronNames}
                squadronRosters={lobby.modules.squadronRosters}
                disabled={busy}
                onSquadronSizeChange={(squadronSize) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      squadronSize,
                      squadronRosters: undefined,
                    },
                  })
                }
                onSquadronNamesChange={(squadronNames) =>
                  void saveSettings({
                    modules: { ...lobby.modules, squadronNames },
                  })
                }
                onSquadronRostersChange={(squadronRosters) =>
                  void saveSettings({
                    modules: { ...lobby.modules, squadronRosters },
                  })
                }
              />
            )}
            <DoubleZeroScoreField
              value={lobby.houseRules?.doubleZeroScore}
              disabled={busy || charterLocked}
              onChange={(doubleZeroScore) =>
                void saveSettings({
                  houseRules: { ...lobby.houseRules, doubleZeroScore },
                })
              }
            />
            <DealHandSizeHint
              playerCount={maxPlayers}
              maxPip={sectorMaxPip}
              largeFleetHandSize={lobby.houseRules?.largeFleetHandSize}
            />
            {isLargeFleetHandSizeChoiceVisible(maxPlayers) ? (
              <LargeFleetHandSizeField
                value={lobby.houseRules?.largeFleetHandSize}
                disabled={busy || charterLocked}
                onChange={(largeFleetHandSize) =>
                  void saveSettings({
                    houseRules: { ...lobby.houseRules, largeFleetHandSize },
                  })
                }
              />
            ) : null}
            <SubspaceFractureOptions
              enabled={lobby.modules.subspaceFracture ?? false}
              scope={lobby.modules.subspaceFractureScope ?? 'own-trail'}
              disabled={busy || charterLocked}
              onEnabledChange={(enabled) =>
                void saveSettings({
                  modules: {
                    ...lobby.modules,
                    subspaceFracture: enabled,
                  },
                })
              }
              onScopeChange={(scope) =>
                void saveSettings({
                  modules: {
                    ...lobby.modules,
                    subspaceFractureScope: scope,
                  },
                })
              }
            />
            <HouseRulesOptions
              value={lobby.houseRules ?? {}}
              disabled={busy || charterLocked}
              onChange={(patch) =>
                void saveSettings({
                  houseRules: { ...lobby.houseRules, ...patch },
                })
              }
            />
          </fieldset>
        )}

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

        <div className={styles.hostActions}>
          {isHost ? (
            <button
              type="button"
              className={styles.primary}
              disabled={busy || lobby.captains.length < ONLINE_MIN_PLAYERS}
              onClick={launch}
            >
              Launch mission
            </button>
          ) : (
            <p className={styles.subtitle}>Awaiting host to launch…</p>
          )}
        </div>

        <button
          type="button"
          className={styles.secondary}
          disabled={busy}
          onClick={() => void depart()}
        >
          {lobby.hostId === uid ? 'Cancel sector' : 'Leave sector'}
        </button>
      </section>
    );
  }

  return (
    <>
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <LobbyForm
        gameCode={gameCode}
        onGameCodeChange={setGameCode}
        displayName={displayName}
        onDisplayNameChange={setDisplayName}
        createOptions={createOptions}
        onCreateOptionsChange={setCreateOptions}
        onCreate={openSector}
        onJoin={() => void joinSector()}
        busy={busy}
        error={error}
        firebaseReady={auth.ready}
        firebaseConfigured={auth.configured}
        myCharters={
          auth.user && !auth.user.isAnonymous ? myCharters : []
        }
      />
    </>
  );
}

export default OnlineLobbyPage;
