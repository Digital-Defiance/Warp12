import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';

import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_GAME_OBJECTIVE,
  GAME_OBJECTIVE_LABELS,
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
import { CampaignRoundsField, ObjectivePicker, ObjectiveSummary } from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { DoubleZeroScoreField } from './double-zero-score-field';
import { SubspaceFractureOptions } from './subspace-fracture-options';
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
  WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
  warp12OfficialCreateLobbyOptions,
} from '../game/warp12-preset.js';
import styles from './lobby.module.scss';

const DEFAULT_CREATE_OPTIONS = warp12OfficialCreateLobbyOptions();

export function OnlineLobbyPage() {
  const { gameId: routeGameId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useFirebaseAuth();

  const [gameCode, setGameCode] = useState(routeGameId?.toUpperCase() ?? '');
  const [displayName, setDisplayName] = useState('');
  const [createOptions, setCreateOptions] =
    useState<CreateLobbyOptions>(DEFAULT_CREATE_OPTIONS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lobby, setLobby] = useState<FirestoreGameDocument | null>(null);
  const [lobbyLoaded, setLobbyLoaded] = useState(false);
  const [myCharters, setMyCharters] = useState<PublicCharterView[]>([]);

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
    return subscribeLobby(
      routeGameId.toUpperCase(),
      (doc) => {
        setLobbyLoaded(true);
        setLobby(doc);
        if (
          doc?.phase === 'active' &&
          uid &&
          doc.captainIds.includes(uid)
        ) {
          navigate(`/online/${routeGameId.toUpperCase()}/play`, {
            replace: true,
          });
        }
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
    modules?: CreateLobbyOptions['modules'];
    houseRules?: CreateLobbyOptions['houseRules'];
    rated?: boolean;
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
      <p className={styles.waitingMessage}>Establishing subspace link…</p>
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

        {(() => {
          const eligibility = onlineMatchRatingEligibility(
            lobby.captains,
            objective,
            lobby.rated ?? true
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
              checked={lobby.rated ?? true}
              disabled={busy}
              onChange={(e) => void saveSettings({ rated: e.target.checked })}
            />
            <span>
              Rated sector — count results toward TEI (quick-hail comms only
              during play). Uncheck for a casual game with open chat.
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
            onChange={(value) => void saveSettings({ objective: value })}
          />
        ) : (
          <ObjectiveSummary
            objective={objective}
            campaignRounds={campaignRounds}
          />
        )}

        {isHost && objective === 'points' && (
          <fieldset className={styles.fieldset}>
            <legend>Campaign length</legend>
            <CampaignRoundsField
              value={campaignRounds}
              disabled={busy || charterLocked}
              onChange={(value) => void saveSettings({ campaignRounds: value })}
            />
          </fieldset>
        )}

        {isHost && (
          <fieldset className={styles.fieldset}>
            <legend>Mission settings</legend>
            <Warp12RulesPreset
              disabled={busy || charterLocked}
              onApply={() =>
                void saveSettings({
                  objective: WARP12_OFFICIAL_OBJECTIVE,
                  campaignRounds: WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
                  modules: { ...WARP12_OFFICIAL_MODULES },
                  houseRules: { ...WARP12_OFFICIAL_HOUSE_RULES },
                })
              }
            />
            <label className={styles.field}>
              <span>Fleet capacity</span>
              <select
                aria-label="Fleet capacity"
                value={maxPlayers}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    maxPlayers: clampOnlineMaxPlayers(Number(e.target.value)),
                  })
                }
              >
                {Array.from(
                  { length: ONLINE_MAX_PLAYERS - (ONLINE_MIN_PLAYERS + 1) + 1 },
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
              <span>Module Beta — Salamander penalty</span>
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={lobby.modules.qContinuum}
                disabled={busy || charterLocked}
                onChange={(e) =>
                  void saveSettings({
                    modules: {
                      ...lobby.modules,
                      qContinuum: e.target.checked,
                    },
                  })
                }
              />
              <span>Module Alpha — Q-Continuum</span>
            </label>
            <DoubleZeroScoreField
              value={lobby.houseRules?.doubleZeroScore}
              disabled={busy || charterLocked}
              onChange={(doubleZeroScore) =>
                void saveSettings({
                  houseRules: { ...lobby.houseRules, doubleZeroScore },
                })
              }
            />
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
