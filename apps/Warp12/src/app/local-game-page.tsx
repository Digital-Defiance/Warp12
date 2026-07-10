import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  DEFAULT_GAME_OBJECTIVE,
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  aiSkillToTacticalClass,
  defaultCampaignRounds,
  formatAiSkillRatedLabel,
  formatAiSkillUnratedLabel,
  formatTacticalClass,
  formatTei,
  TEI_OBJECTIVE_LABEL,
  type GameObjective,
  type HouseRulesConfig,
  type SubspaceFractureScope,
  type WarpAiPlayer,
  type WarpSkillLevel,
} from 'warp12-engine';

import { AcademyPlacementFieldset } from './academy-placement-fieldset';
import { BridgeTable } from './bridge-table';
import styles from './lobby.module.scss';
import { CampaignRoundsField, ObjectivePicker } from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { DoubleZeroScoreField } from './double-zero-score-field';
import { LargeFleetHandSizeField } from './large-fleet-hand-size-field';
import { SubspaceFractureOptions } from './subspace-fracture-options';
import { Warp12RulesPreset } from './warp12-rules-preset';
import {
  buildAiRosterAsync,
  createLocalGame,
} from '../game/create-local-game.js';
import { preloadOmegaWeights } from '../ai/load-omega-weights.js';
import {
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
} from '../game/warp12-preset.js';
import {
  buildAiCaptains,
  clampLocalPlayerCount,
  maxPlayersForFactor,
  minPlayersForFactor,
  neuralAiSupported,
  soloHumanCaptain,
  type AiCaptainConfig,
  type LocalGameConfig,
} from '../game/local-game-config.js';
import { drawMatchSeed } from '../game/match-seed.js';
import { classifyLocalAiMatchSkill } from '../game/local-match-stats.js';
import { opponentTeiForObjective } from '../firebase/stats-elo.js';
import { WARP12_OFFICIAL_RULES_PROFILE_ID } from '../firebase/rules-profile.js';
import type { RatedObjective } from '../firebase/stats-schema.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import { requireWarpFactor } from './warp-factor.js';

type SetupPhase = 'configure' | 'playing';

type AiOfficerTier = WarpSkillLevel;

interface LocalLaunchSession {
  readonly config: LocalGameConfig;
  readonly seed: number;
  readonly roster: ReadonlyMap<string, WarpAiPlayer>;
}

function applyAiTierOverrides(
  aiCaptains: readonly AiCaptainConfig[],
  tiers: Record<string, AiOfficerTier>,
  extendedThinking: Record<string, boolean>
): AiCaptainConfig[] {
  return aiCaptains.map((ai) => {
    const tier = tiers[ai.id] ?? ai.skill;
    const thinking =
      tier === 'commander' ? extendedThinking[ai.id] === true : false;
    return { ...ai, skill: tier, omega: false, extendedThinking: thinking };
  });
}

function ratedObjective(objective: GameObjective): RatedObjective | null {
  return objective === 'go-out' || objective === 'points' ? objective : null;
}

function skillOptionLabel(
  skill: WarpSkillLevel,
  objective: RatedObjective,
  rulesProfileId: string
): string {
  return formatAiSkillRatedLabel(
    skill,
    opponentTeiForObjective(objective, skill, rulesProfileId)
  );
}

export function LocalGamePage() {
  const maxPip = requireWarpFactor();
  const fleetMin = minPlayersForFactor(maxPip);
  const fleetMax = maxPlayersForFactor(maxPip);
  const [phase, setPhase] = useState<SetupPhase>('configure');
  const [humanName, setHumanName] = useState('Armstrong');
  const [playerCount, setPlayerCount] = useState(() =>
    clampLocalPlayerCount(4, maxPip)
  );
  const [objective, setObjective] = useState<GameObjective>(DEFAULT_GAME_OBJECTIVE);
  const [campaignRounds, setCampaignRounds] = useState(() =>
    defaultCampaignRounds(maxPip)
  );
  const [salamander, setSalamander] = useState(
    WARP12_OFFICIAL_MODULES.salamanderPenalty ?? true
  );
  const [continuum, setContinuum] = useState(
    WARP12_OFFICIAL_MODULES.continuum ?? true
  );
  const [subspaceFracture, setSubspaceFracture] = useState(
    WARP12_OFFICIAL_MODULES.subspaceFracture ?? false
  );
  const [subspaceFractureScope, setSubspaceFractureScope] =
    useState<SubspaceFractureScope>(
      WARP12_OFFICIAL_MODULES.subspaceFractureScope ?? DEFAULT_SUBSPACE_FRACTURE_SCOPE
    );
  const [houseRules, setHouseRules] = useState<HouseRulesConfig>({
    ...WARP12_OFFICIAL_HOUSE_RULES,
  });
  const [aiTiers, setAiTiers] = useState<Record<string, AiOfficerTier>>({});
  const [extendedThinkingByAi, setExtendedThinkingByAi] = useState<
    Record<string, boolean>
  >({});
  const [academySaving, setAcademySaving] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!neuralAiSupported(maxPip)) return;
    void preloadOmegaWeights(objective).catch(() => {
      /* Preload is best-effort; launch fails hard if weights are missing. */
    });
  }, [objective, maxPip]);

  const applyOfficialWarp12Rules = () => {
    setObjective(WARP12_OFFICIAL_OBJECTIVE);
    setCampaignRounds(defaultCampaignRounds(maxPip));
    setSalamander(WARP12_OFFICIAL_MODULES.salamanderPenalty ?? true);
    setContinuum(WARP12_OFFICIAL_MODULES.continuum ?? true);
    setSubspaceFracture(WARP12_OFFICIAL_MODULES.subspaceFracture ?? false);
    setSubspaceFractureScope(
      WARP12_OFFICIAL_MODULES.subspaceFractureScope ?? DEFAULT_SUBSPACE_FRACTURE_SCOPE
    );
    setHouseRules({ ...WARP12_OFFICIAL_HOUSE_RULES });
  };

  const playerStats = usePlayerStats();

  const [launchSession, setLaunchSession] = useState<LocalLaunchSession | null>(
    null
  );

  const aiCaptains = useMemo(
    () =>
      buildAiCaptains(clampLocalPlayerCount(playerCount, maxPip) - 1, maxPip),
    [playerCount, maxPip]
  );
  const aiCount = aiCaptains.length;
  const rulesProfileId = WARP12_OFFICIAL_RULES_PROFILE_ID;
  const configuredAiCaptains = useMemo(
    () => applyAiTierOverrides(aiCaptains, aiTiers, extendedThinkingByAi),
    [aiCaptains, aiTiers, extendedThinkingByAi]
  );
  const matchSkill = useMemo(
    () => classifyLocalAiMatchSkill(configuredAiCaptains),
    [configuredAiCaptains]
  );
  const rated = ratedObjective(objective);
  const exhibitionSet = maxPip !== 12;
  const teiTrack = rated && !exhibitionSet ? rated : null;
  const playerTei =
    teiTrack && playerStats.ready
      ? playerStats.displayTei(matchSkill, teiTrack)
      : null;

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
      console.error('[omega] failed to load roster', error);
      setLaunchError(
        'Could not load Class II officer weights — check your connection and try again.'
      );
    } finally {
      setLaunching(false);
    }
  };

  const launch = () => {
    const count = clampLocalPlayerCount(playerCount, maxPip);
    const human = soloHumanCaptain(humanName);
    const next: LocalGameConfig = {
      humanId: human.id,
      humanName: human.displayName,
      humanCaptains: [human],
      playerCount: count,
      objective,
      campaignRounds,
      modules: {
        salamanderPenalty: salamander,
        continuum: continuum,
        subspaceFracture,
        subspaceFractureScope,
      },
      houseRules,
      aiCaptains: applyAiTierOverrides(
        buildAiCaptains(count - 1, maxPip),
        aiTiers,
        extendedThinkingByAi
      ),
      rulesProfileId,
      maxPip,
    };
    void startSession(next, drawMatchSeed());
  };

  const rematch = () => {
    if (!launchSession) return;
    startSession(launchSession.config, drawMatchSeed());
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
    <section className={`${styles.lobby} ${styles.lobbyWide}`}>
      <p className={styles.backLink}>
        <Link to="/">← Back to bridge</Link>
      </p>
      <h2 className={styles.title}>Local simulation</h2>
      <p className={styles.subtitle}>
        You plus {aiCount} AI officer{aiCount === 1 ? '' : 's'}. Choose fleet
        size and how victory is decided.
      </p>
      {exhibitionSet ? (
        <p className={styles.notice} role="status">
          Exhibition set — Warp {maxPip} does not update TEI. Switch to Warp 12
          for rated ladders.
        </p>
      ) : null}

      <label className={styles.field}>
        <span>Your call sign</span>
        <input
          type="text"
          value={humanName}
          maxLength={24}
          onChange={(e) => setHumanName(e.target.value)}
          placeholder="Captain name"
        />
      </label>

      <label className={styles.field}>
        <span>
          Fleet size ({fleetMin}–{fleetMax} captains) · Warp {maxPip}
        </span>
        <select
          aria-label="Fleet size"
          value={playerCount}
          onChange={(e) =>
            setPlayerCount(clampLocalPlayerCount(Number(e.target.value), maxPip))
          }
        >
          {Array.from(
            { length: fleetMax - fleetMin + 1 },
            (_, index) => fleetMin + index
          ).map((count) => (
            <option key={count} value={count}>
              {count} captains — you + {count - 1} AI
            </option>
          ))}
        </select>
      </label>

      <ObjectivePicker
        name="local-objective"
        value={objective}
        onChange={setObjective}
      />

      {objective === 'points' && (
        <fieldset className={styles.fieldset}>
          <legend>Campaign length</legend>
          <CampaignRoundsField
            value={campaignRounds}
            onChange={setCampaignRounds}
          />
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend>Rules preset</legend>
        <Warp12RulesPreset onApply={applyOfficialWarp12Rules} />
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Optional directives</legend>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={salamander}
            onChange={(e) => setSalamander(e.target.checked)}
          />
          <span>Module Beta — Salamander penalty</span>
        </label>
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={continuum}
            onChange={(e) => setContinuum(e.target.checked)}
          />
          <span>Module Alpha — Continuum</span>
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>Game options</legend>
        <DoubleZeroScoreField
          value={houseRules.doubleZeroScore}
          onChange={(doubleZeroScore) =>
            setHouseRules((current) => ({ ...current, doubleZeroScore }))
          }
        />
        {clampLocalPlayerCount(playerCount, maxPip) >= 7 && (
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

      {teiTrack &&
        playerStats.ready &&
        playerStats.needsAcademyPlacementForObjective(teiTrack) && (
        <AcademyPlacementFieldset
          objective={teiTrack}
          saving={academySaving}
          onSave={async (skill) => {
            setAcademySaving(true);
            try {
              await playerStats.saveAcademyPlacement(teiTrack, skill);
            } finally {
              setAcademySaving(false);
            }
          }}
        />
      )}

      {teiTrack &&
        playerStats.ready &&
        !playerStats.needsAcademyPlacementForObjective(teiTrack) && (
        <fieldset className={styles.fieldset}>
          <legend>Solo TEI ({TEI_OBJECTIVE_LABEL[teiTrack]})</legend>
          {playerTei !== null ? (
            <p className={styles.hint}>
              Your TEI vs {formatTacticalClass(aiSkillToTacticalClass(matchSkill))}{' '}
              officers: <strong>{playerTei}</strong>
              {' · '}
              reference{' '}
              {formatTei(
                opponentTeiForObjective(teiTrack, matchSkill, rulesProfileId),
                true
              )}
            </p>
          ) : (
            <p className={styles.hint}>
              Profile saved — your first unassisted match will establish this
              bucket on the leaderboard.
            </p>
          )}
          <p className={styles.hint}>
            Tactical advisor use does not update TEI. Unassisted wins and losses
            move your index toward the reference profile shown above.
          </p>
        </fieldset>
      )}

      <fieldset className={styles.fieldset}>
        <legend>
          AI officers ({aiCaptains.length})
        </legend>
        {aiCaptains.map((ai) => {
          const tier = aiTiers[ai.id] ?? ai.skill;
          return (
          <div key={ai.id} className={styles.aiRow}>
            <span className={styles.aiName}>{ai.displayName}</span>
            <select
              aria-label={`${ai.displayName} tactical class`}
              value={tier}
              onChange={(e) => {
                const nextTier = e.target.value as AiOfficerTier;
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
              {teiTrack ? (
                <>
                  <option value="ensign">
                    {skillOptionLabel('ensign', teiTrack, rulesProfileId)}
                  </option>
                  <option value="lieutenant">
                    {skillOptionLabel('lieutenant', teiTrack, rulesProfileId)}
                  </option>
                  <option value="commander">
                    {skillOptionLabel('commander', teiTrack, rulesProfileId)}
                  </option>
                </>
              ) : (
                <>
                  <option value="ensign">
                    {formatAiSkillUnratedLabel('ensign')}
                  </option>
                  <option value="lieutenant">
                    {formatAiSkillUnratedLabel('lieutenant')}
                  </option>
                  <option value="commander">
                    {formatAiSkillUnratedLabel('commander')}
                  </option>
                </>
              )}
            </select>
            {tier === 'commander' ? (
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={extendedThinkingByAi[ai.id] === true}
                  onChange={(e) =>
                    setExtendedThinkingByAi((current) => ({
                      ...current,
                      [ai.id]: e.target.checked,
                    }))
                  }
                />
                <span>Extended thinking (unrated)</span>
              </label>
            ) : null}
          </div>
        );
        })}
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
          {launching ? 'Loading Class II…' : 'Launch simulation'}
        </button>
      </div>
    </section>
  );
}

export default LocalGamePage;
