import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  defaultCampaignRounds,
  formatAiSkillUnratedLabel,
  isModuleAvailableForObjective,
  type GameObjective,
  type HouseRulesConfig,
  type SubspaceFractureScope,
  type WarpAiPlayer,
  type WarpSkillLevel,
} from 'warp12-engine';
import { setWarpFactor, useRequireWarpFactor, type WarpFactor } from './warp-factor.js';
import { FactorGauge } from './factor-gauge';
import { useAnnounce } from '../a11y/live-announcer.js';

import { BridgeTable } from './bridge-table';
import { goOutAwareModuleLabel } from './go-out-module-labels.js';
import styles from './lobby.module.scss';
import {
  CampaignRoundsField,
  GoOutCampaignField,
  MatchStarterPicker,
  ObjectivePicker,
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
import { Warp12RulesPreset } from './warp12-rules-preset';
import { SetupPresetsBar } from './setup-presets-bar';
import {
  passAndPlaySnapshotToPreset,
  presetToPassAndPlaySnapshot,
  resolveLastUsedPreset,
  writeLastUsedPreset,
  type PassAndPlaySetupSnapshot,
  type WarpSetupPreset,
} from '../game/setup-presets.js';
import {
  buildAiRosterAsync,
  createLocalGame,
} from '../game/create-local-game.js';
import {
  applyAiTierOverrides,
  buildAiCaptains,
  buildHumanCaptains,
  clampPassAndPlayPlayerCount,
  DEFAULT_HUMAN_CAPTAIN_NAMES,
  maxPlayersForFactor,
  neuralAiSupported,
  PASS_AND_PLAY_MIN_PLAYERS,
  type LocalGameConfig,
} from '../game/local-game-config.js';
import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
} from '../game/warp12-preset.js';
import { drawMatchSeed } from '../game/match-seed.js';
import { Warp12Logo } from './Warp12Logo.js';

type SetupPhase = 'configure' | 'playing';

interface PassAndPlayLaunchSession {
  readonly config: LocalGameConfig;
  readonly seed: number;
  readonly roster: ReadonlyMap<string, WarpAiPlayer>;
}

export function PassAndPlayPage() {
  const announce = useAnnounce();
  const maxPip = useRequireWarpFactor();
  const fleetMax = maxPlayersForFactor(maxPip);
  const [phase, setPhase] = useState<SetupPhase>('configure');
  const [initialSnapshot] = useState(() =>
    presetToPassAndPlaySnapshot(resolveLastUsedPreset('pass-and-play'), maxPip)
  );
  const [playerCount, setPlayerCount] = useState(initialSnapshot.playerCount);
  const [humanNames, setHumanNames] = useState<string[]>(
    initialSnapshot.humanNames
  );
  const [aiFillCount, setAiFillCount] = useState(initialSnapshot.aiFillCount);
  const [aiTiers, setAiTiers] = useState<Record<string, WarpSkillLevel>>(
    initialSnapshot.aiTiers
  );
  const [extendedThinkingByAi, setExtendedThinkingByAi] = useState<
    Record<string, boolean>
  >(initialSnapshot.aiExtendedThinking);
  const [objective, setObjective] = useState<GameObjective>(
    initialSnapshot.objective
  );
  const [campaignRounds, setCampaignRounds] = useState(
    initialSnapshot.campaignRounds
  );
  const [goOutCampaign, setGoOutCampaign] = useState<GoOutCampaignConfig>(() => ({
    goOutStructure: initialSnapshot.goOutStructure,
    goOutWinsToWin: initialSnapshot.goOutWinsToWin,
    goOutOvertime: initialSnapshot.goOutOvertime,
    campaignRounds: initialSnapshot.campaignRounds,
  }));
  const [matchStarterIndex, setMatchStarterIndex] = useState(
    initialSnapshot.matchStarterIndex
  );
  const [salamander, setSalamander] = useState(
    initialSnapshot.modules.salamanderPenalty === true
  );
  const [continuum, setContinuum] = useState(
    initialSnapshot.modules.continuum === true
  );
  const [sensorGrid, setSensorGrid] = useState(
    initialSnapshot.modules.sensorGrid === true
  );
  const [warpDriveSpool, setWarpDriveSpool] = useState(
    initialSnapshot.modules.warpDriveSpool ?? false
  );
  const [longestTrail, setLongestTrail] = useState(
    initialSnapshot.modules.longestTrail ?? false
  );
  const [doubleDown, setDoubleDown] = useState(
    initialSnapshot.modules.doubleDown ?? false
  );
  const [temporalDebt, setTemporalDebt] = useState(
    initialSnapshot.modules.temporalDebt ?? false
  );
  const [drafting, setDrafting] = useState(
    initialSnapshot.modules.drafting ?? false
  );
  const [temporalInversion, setTemporalInversion] = useState(
    initialSnapshot.modules.temporalInversion ?? false
  );
  const [wormholes, setWormholes] = useState(
    initialSnapshot.modules.wormholes ?? false
  );
  const [subspaceFracture, setSubspaceFracture] = useState(
    initialSnapshot.modules.subspaceFracture ?? false
  );
  const [subspaceFractureScope, setSubspaceFractureScope] =
    useState<SubspaceFractureScope>(
      initialSnapshot.modules.subspaceFractureScope ??
        DEFAULT_SUBSPACE_FRACTURE_SCOPE
    );
  const [houseRules, setHouseRules] = useState<HouseRulesConfig>(
    initialSnapshot.houseRules
  );
  const [launchSession, setLaunchSession] = useState<PassAndPlayLaunchSession | null>(
    null
  );
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  // Keep fleet size / AI fill / names inside the new factor's limits when the dial changes.
  useEffect(() => {
    const capped = clampPassAndPlayPlayerCount(playerCount, maxPip);
    if (capped !== playerCount) {
      setPlayerCount(capped);
    }
    setHumanNames((current) => {
      if (current.length === capped) return current;
      return Array.from(
        { length: capped },
        (_, index) =>
          current[index] ??
          DEFAULT_HUMAN_CAPTAIN_NAMES[index] ??
          `Captain ${index + 1}`
      );
    });
    setAiFillCount((current) =>
      Math.min(current, Math.max(0, capped - PASS_AND_PLAY_MIN_PLAYERS))
    );
  }, [maxPip]); // eslint-disable-line react-hooks/exhaustive-deps -- clamp only on factor change

  useEffect(() => {
    if (neuralAiSupported(maxPip)) return;
    setExtendedThinkingByAi({});
  }, [maxPip]);

  const applyOfficialWarp12Rules = () => {
    setObjective(WARP12_OFFICIAL_OBJECTIVE);
    setCampaignRounds(defaultCampaignRounds(maxPip));
    setSalamander(WARP12_OFFICIAL_MODULES.salamanderPenalty ?? true);
    setContinuum(WARP12_OFFICIAL_MODULES.continuum ?? true);
    setSensorGrid(false);
    setWarpDriveSpool(false);
    setLongestTrail(false);
    setDoubleDown(false);
    setTemporalDebt(false);
    setDrafting(false);
    setTemporalInversion(false);
    setWormholes(false);
    setSubspaceFracture(WARP12_OFFICIAL_MODULES.subspaceFracture ?? false);
    setSubspaceFractureScope(
      WARP12_OFFICIAL_MODULES.subspaceFractureScope ?? DEFAULT_SUBSPACE_FRACTURE_SCOPE
    );
    setHouseRules({ ...WARP12_OFFICIAL_HOUSE_RULES });
  };

  const currentSnapshot = (): PassAndPlaySetupSnapshot => ({
    playerCount,
    aiFillCount,
    humanNames,
    objective,
    campaignRounds: objective === 'go-out' ? goOutCampaign.campaignRounds : campaignRounds,
    goOutStructure: goOutCampaign.goOutStructure,
    goOutWinsToWin: goOutCampaign.goOutWinsToWin,
    goOutOvertime: goOutCampaign.goOutOvertime,
    matchStarterIndex,
    modules: {
      salamanderPenalty: salamander,
      continuum,
      sensorGrid,
      warpDriveSpool,
      longestTrail,
      doubleDown,
      temporalDebt,
      drafting: isModuleAvailableForObjective('drafting', objective)
        ? drafting
        : false,
      temporalInversion,
      wormholes,
      subspaceFracture,
      subspaceFractureScope,
    },
    houseRules,
    aiTiers,
    aiExtendedThinking: extendedThinkingByAi,
  });

  const applyPreset = (preset: WarpSetupPreset) => {
    const snap = presetToPassAndPlaySnapshot(preset, maxPip);
    setPlayerCount(snap.playerCount);
    setHumanNames(snap.humanNames);
    setAiFillCount(snap.aiFillCount);
    setAiTiers(snap.aiTiers);
    setExtendedThinkingByAi(snap.aiExtendedThinking);
    setObjective(snap.objective);
    setCampaignRounds(snap.campaignRounds);
    setGoOutCampaign({
      goOutStructure: snap.goOutStructure,
      goOutWinsToWin: snap.goOutWinsToWin,
      goOutOvertime: snap.goOutOvertime,
      campaignRounds: snap.campaignRounds,
    });
    setMatchStarterIndex(snap.matchStarterIndex);
    setSalamander(snap.modules.salamanderPenalty === true);
    setContinuum(snap.modules.continuum === true);
    setSensorGrid(snap.modules.sensorGrid === true);
    setWarpDriveSpool(snap.modules.warpDriveSpool === true);
    setLongestTrail(snap.modules.longestTrail === true);
    setDoubleDown(snap.modules.doubleDown === true);
    setTemporalDebt(snap.modules.temporalDebt === true);
    setDrafting(
      isModuleAvailableForObjective('drafting', snap.objective) &&
        snap.modules.drafting === true
    );
    setTemporalInversion(snap.modules.temporalInversion === true);
    setWormholes(snap.modules.wormholes === true);
    setSubspaceFracture(snap.modules.subspaceFracture === true);
    setSubspaceFractureScope(
      snap.modules.subspaceFractureScope ?? DEFAULT_SUBSPACE_FRACTURE_SCOPE
    );
    setHouseRules(snap.houseRules);
  };

  const cappedCount = clampPassAndPlayPlayerCount(playerCount, maxPip);
  const humanCount = cappedCount - aiFillCount;
  const aiCount = aiFillCount;
  const exhibitionSet = !neuralAiSupported(maxPip);
  const aiCaptains = useMemo(
    () => buildAiCaptains(aiFillCount, maxPip),
    [aiFillCount, maxPip]
  );
  const configuredAiCaptains = useMemo(
    () =>
      applyAiTierOverrides(
        aiCaptains,
        aiTiers,
        extendedThinkingByAi,
        neuralAiSupported(maxPip)
      ),
    [aiCaptains, aiTiers, extendedThinkingByAi, maxPip]
  );

  const syncPlayerCount = (count: number) => {
    const next = clampPassAndPlayPlayerCount(count, maxPip);
    setPlayerCount(next);
    setHumanNames((current) =>
      Array.from({ length: next }, (_, index) => current[index] ?? DEFAULT_HUMAN_CAPTAIN_NAMES[index] ?? `Captain ${index + 1}`)
    );
    setAiFillCount((current) => Math.min(current, next - PASS_AND_PLAY_MIN_PLAYERS));
  };

  const syncAiFillCount = (count: number) => {
    const maxAi = cappedCount - PASS_AND_PLAY_MIN_PLAYERS;
    setAiFillCount(Math.min(Math.max(0, count), maxAi));
  };

  const game = useMemo(() => {
    if (!launchSession) return null;
    return createLocalGame(launchSession.config, launchSession.seed);
  }, [launchSession]);

  const startSession = async (config: LocalGameConfig, seed: number) => {
    setLaunchError(null);
    setLaunching(true);
    try {
      const roster = await buildAiRosterAsync(config, seed);
      setLaunchSession({
        config,
        seed,
        roster,
      });
      setPhase('playing');
    } catch (error) {
      console.error('[omega] pass-and-play roster failed', error);
      setLaunchError(
        'Could not load Commander officer weights — check your connection and try again.'
      );
    } finally {
      setLaunching(false);
    }
  };

  const launch = () => {
    const snap = currentSnapshot();
    const count = clampPassAndPlayPlayerCount(snap.playerCount, maxPip);
    const humans = buildHumanCaptains(
      count - snap.aiFillCount,
      snap.humanNames.slice(0, count - snap.aiFillCount),
      maxPip
    );
    const primary = humans[0];
    const aiCaptainsList = applyAiTierOverrides(
      buildAiCaptains(snap.aiFillCount, maxPip),
      snap.aiTiers,
      snap.aiExtendedThinking,
      neuralAiSupported(maxPip)
    );
    const allCaptains = [
      ...humans.map((h) => ({ id: h.id, displayName: h.displayName })),
      ...aiCaptainsList.map((ai) => ({ id: ai.id, displayName: ai.displayName })),
    ];
    const safeStarterIndex =
      snap.matchStarterIndex >= 0 && snap.matchStarterIndex < allCaptains.length
        ? snap.matchStarterIndex
        : undefined;
    const next: LocalGameConfig = {
      humanId: primary.id,
      humanName: primary.displayName,
      humanCaptains: humans,
      playerCount: count,
      objective: snap.objective,
      campaignRounds: snap.campaignRounds,
      goOutStructure: snap.goOutStructure,
      goOutWinsToWin: snap.goOutWinsToWin,
      goOutOvertime: snap.goOutOvertime,
      matchStarterIndex: safeStarterIndex,
      modules: snap.modules,
      houseRules: snap.houseRules,
      aiCaptains: aiCaptainsList,
      maxPip,
    };
    writeLastUsedPreset(
      'pass-and-play',
      passAndPlaySnapshotToPreset(snap, maxPip)
    );
    void startSession(next, drawMatchSeed());
  };

  const rematch = () => {
    if (!launchSession) return;
    void startSession(launchSession.config, drawMatchSeed());
  };

  if (phase === 'playing' && game && launchSession) {
    return (
      <BridgeTable
        mode="local"
        game={game}
        key={launchSession.seed}
        matchSeed={launchSession.seed}
        localConfig={launchSession.config}
        aiPlayers={launchSession.roster}
        onRematch={rematch}
        onLeaveSetup={() => {
          setLaunchSession(null);
          setPhase('configure');
        }}
      />
    );
  }

  return (
    <>
    <div className={styles.factorGaugeContainer}>
      <FactorGauge
        width={200}
        factor={maxPip}
        onFactorSelect={(next: WarpFactor) => {
          setWarpFactor(next);
          announce(`Warp factor ${next}`, 'polite');
        }}
      />
      <div className={styles.factorGaugeLogoContainer}>
        <Warp12Logo factor={maxPip} width={200} taglineOff={true} />
      </div>
    </div>
    <section className={`${styles.lobby} ${styles.lobbyWide}`}>
      <p className={styles.backLink}>
        <Link to="/">← Back to bridge</Link>
      </p>
      <h2 className={styles.title}>Pass and play</h2>
      <p className={styles.subtitle}>
        Share one device — {humanCount} human captain{humanCount === 1 ? '' : 's'}
        {aiCount > 0 ? ` plus ${aiCount} AI officer${aiCount === 1 ? '' : 's'}` : ''}.
        Unrated local table only.
      </p>

      <p className={styles.notice} role="note">
        Pass-and-play matches never update TEI or the public leaderboard. Pass the
        bridge when the turn indicator changes so the next captain can helm without
        peeking.
      </p>
      {exhibitionSet && aiCount > 0 ? (
        <p className={styles.notice} role="status">
          Exhibition set — Warp {maxPip} uses heuristic Commander officers until
          neural weights ship for this factor (Warp 12 has Ω today).
        </p>
      ) : null}

      <SetupPresetsBar
        setupType="pass-and-play"
        getCurrentPreset={() =>
          passAndPlaySnapshotToPreset(currentSnapshot(), maxPip)
        }
        onApply={applyPreset}
      />

      <label className={styles.field}>
        <span>
          Fleet size ({PASS_AND_PLAY_MIN_PLAYERS}–{fleetMax} captains) · Warp {maxPip}
        </span>
        <select
          aria-label="Fleet size"
          value={playerCount}
          onChange={(e) => syncPlayerCount(Number(e.target.value))}
        >
          {Array.from(
            { length: fleetMax - PASS_AND_PLAY_MIN_PLAYERS + 1 },
            (_, index) => PASS_AND_PLAY_MIN_PLAYERS + index
          ).map((count) => (
            <option key={count} value={count}>
              {count} captains
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>AI officers to fill empty seats</span>
        <select
          aria-label="AI officers"
          value={aiFillCount}
          onChange={(e) => syncAiFillCount(Number(e.target.value))}
        >
          {Array.from({ length: cappedCount - PASS_AND_PLAY_MIN_PLAYERS + 1 }, (_, index) => (
            <option key={index} value={index}>
              {index === 0
                ? 'Humans only'
                : `${index} AI officer${index === 1 ? '' : 's'}`}
            </option>
          ))}
        </select>
      </label>

      {aiCount > 0 ? (
        <fieldset className={styles.fieldset}>
          <legend>AI officers ({aiCount})</legend>
          <p className={styles.hint}>
            Pick each officer&apos;s commission track. Pass-and-play is always
            unrated — extended thinking (Ω+) is optional on Commander seats.
          </p>
          {configuredAiCaptains.map((ai) => {
            const tier = aiTiers[ai.id] ?? ai.skill;
            return (
              <div key={ai.id} className={styles.aiRow}>
                <span className={styles.aiName}>{ai.displayName}</span>
                <select
                  aria-label={`${ai.displayName} commission track`}
                  value={tier}
                  onChange={(e) => {
                    const nextTier = e.target.value as WarpSkillLevel;
                    setAiTiers((current) => ({
                      ...current,
                      [ai.id]: nextTier,
                    }));
                    if (nextTier !== 'commander') {
                      setExtendedThinkingByAi((current) => ({
                        ...current,
                        [ai.id]: false,
                      }));
                    }
                  }}
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
                {tier === 'commander' && neuralAiSupported(maxPip) ? (
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={extendedThinkingByAi[ai.id] === true}
                      aria-label={`${ai.displayName}: extended thinking`}
                      onChange={(e) =>
                        setExtendedThinkingByAi((current) => ({
                          ...current,
                          [ai.id]: e.target.checked,
                        }))
                      }
                    />
                    <span>Extended thinking (Ω+)</span>
                  </label>
                ) : null}
              </div>
            );
          })}
        </fieldset>
      ) : null}

      <fieldset className={styles.fieldset}>
        <legend>Human captains ({humanCount})</legend>
        {Array.from({ length: humanCount }, (_, index) => (
          <label key={index} className={styles.field}>
            <span>Captain {index + 1}</span>
            <input
              type="text"
              value={humanNames[index] ?? ''}
              maxLength={24}
              onChange={(e) =>
                setHumanNames((current) => {
                  const next = [...current];
                  next[index] = e.target.value;
                  return next;
                })
              }
              placeholder={DEFAULT_HUMAN_CAPTAIN_NAMES[index] ?? `Captain ${index + 1}`}
            />
          </label>
        ))}
      </fieldset>

      <ObjectivePicker
        name="pass-and-play-objective"
        value={objective}
        onChange={(next) => {
          setObjective(next);
          if (!isModuleAvailableForObjective('drafting', next)) {
            setDrafting(false);
          }
        }}
      />

      {objective === 'points' && (
        <fieldset className={styles.fieldset}>
          <legend>Campaign length</legend>
          <CampaignRoundsField
            value={campaignRounds}
            onChange={setCampaignRounds}
            maxPip={maxPip}
          />
        </fieldset>
      )}

      {objective === 'go-out' && (
        <GoOutCampaignField
          name="pnp-go-out"
          value={goOutCampaign}
          onChange={setGoOutCampaign}
          maxPip={maxPip}
        />
      )}

      <MatchStarterPicker
        captains={[
          ...buildHumanCaptains(
            clampPassAndPlayPlayerCount(playerCount, maxPip) - aiFillCount,
            humanNames,
            maxPip
          ),
          ...buildAiCaptains(aiFillCount, maxPip),
        ]}
        value={matchStarterIndex}
        onChange={setMatchStarterIndex}
      />

      <fieldset className={styles.fieldset}>
        <legend>Rules preset</legend>
        <Warp12RulesPreset maxPip={maxPip} onApply={applyOfficialWarp12Rules} />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Optional directives</legend>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={continuum}
            onChange={(e) => setContinuum(e.target.checked)}
          />
          <span>Module Alpha — Continuum</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={salamander}
            onChange={(e) => setSalamander(e.target.checked)}
          />
          <span>{goOutAwareModuleLabel('beta', objective)}</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={sensorGrid}
            onChange={(e) => setSensorGrid(e.target.checked)}
          />
          <span>Module Gamma — Long-Range Sensor Sweep</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={warpDriveSpool}
            onChange={(e) => setWarpDriveSpool(e.target.checked)}
          />
          <span>Module Delta — Hot Potato (Warp Drive Spool)</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={longestTrail}
            onChange={(e) => setLongestTrail(e.target.checked)}
          />
          <span>{goOutAwareModuleLabel('theta', objective)}</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={doubleDown}
            onChange={(e) => setDoubleDown(e.target.checked)}
          />
          <span>Module Iota — Double Down</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={temporalDebt}
            onChange={(e) => setTemporalDebt(e.target.checked)}
          />
          <span>{goOutAwareModuleLabel('eta', objective)}</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={
              isModuleAvailableForObjective('drafting', objective)
                ? drafting
                : false
            }
            disabled={!isModuleAvailableForObjective('drafting', objective)}
            onChange={(e) => setDrafting(e.target.checked)}
          />
          <span>{goOutAwareModuleLabel('epsilon', objective)}</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={temporalInversion}
            onChange={(e) => setTemporalInversion(e.target.checked)}
          />
          <span>{goOutAwareModuleLabel('kappa', objective)}</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={wormholes}
            onChange={(e) => setWormholes(e.target.checked)}
          />
          <span>Module Lambda — Wormholes (Warped/Exhibition)</span>
        </label>
        <div className={`${styles.checkboxRow} ${styles.checkboxRowDisabled}`}>
          <input
            type="checkbox"
            checked={false}
            disabled
            readOnly
            aria-label="Module Zeta — Fleet Squadrons (online only)"
          />
          <span>Module Zeta — Fleet Squadrons</span>
          <Link
            to="/online"
            className={styles.onlineOnlyBadge}
            aria-label="Fleet Squadrons is online only — open the online lobby"
          >
            Online only
          </Link>
        </div>
        <p className={styles.moduleHint}>
          Team play with shared trails &amp; beacons — assemble crews in an
          online sector.
        </p>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Game options</legend>
        <DoubleZeroScoreField
          value={houseRules.doubleZeroScore}
          onChange={(doubleZeroScore) =>
            setHouseRules((current) => ({ ...current, doubleZeroScore }))
          }
        />
        <DealHandSizeHint
          playerCount={playerCount}
          maxPip={maxPip}
          largeFleetHandSize={houseRules.largeFleetHandSize}
        />
        {isLargeFleetHandSizeChoiceVisible(playerCount) && (
          <LargeFleetHandSizeField
            value={houseRules.largeFleetHandSize}
            onChange={(largeFleetHandSize) =>
              setHouseRules((current) => ({ ...current, largeFleetHandSize }))
            }
          />
        )}
        <SubspaceFractureOptions
          enabled={subspaceFracture}
          scope={subspaceFractureScope}
          onEnabledChange={setSubspaceFracture}
          onScopeChange={setSubspaceFractureScope}
        />
        <HouseRulesOptions
          value={houseRules}
          onChange={(patch) =>
            setHouseRules((current) => ({ ...current, ...patch }))
          }
        />
      </fieldset>

      <div className={styles.actions}>
        {launchError ? (
          <p className={styles.hint} role="alert">
            {launchError}
          </p>
        ) : null}
        <button
          type="button"
          className={styles.primary}
          disabled={launching}
          onClick={launch}
        >
          {launching
            ? neuralAiSupported(maxPip) && aiCount > 0
              ? 'Loading Commander…'
              : 'Launching…'
            : 'Launch table'}
        </button>
      </div>
    </section>
    </>
  );
}

export default PassAndPlayPage;
