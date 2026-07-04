import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  CLASS1_STAR_DISPLAY_NAME,
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_GAME_OBJECTIVE,
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  aiSkillToTacticalClass,
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
import { SubspaceFractureOptions } from './subspace-fracture-options';
import { Warp12RulesPreset } from './warp12-rules-preset';
import {
  buildAiRoster,
  createLocalGame,
} from '../game/create-local-game.js';
import {
  WARP12_OFFICIAL_CAMPAIGN_ROUNDS,
  WARP12_OFFICIAL_HOUSE_RULES,
  WARP12_OFFICIAL_MODULES,
  WARP12_OFFICIAL_OBJECTIVE,
} from '../game/warp12-preset.js';
import {
  buildAiCaptains,
  clampLocalPlayerCount,
  LOCAL_MAX_PLAYERS,
  LOCAL_MIN_PLAYERS,
  soloHumanCaptain,
  type AiCaptainConfig,
  type LocalGameConfig,
} from '../game/local-game-config.js';
import { drawMatchSeed } from '../game/match-seed.js';
import { classifyLocalAiMatchSkill } from '../game/local-match-stats.js';
import { opponentTeiForObjective } from '../firebase/stats-elo.js';
import type { RatedObjective } from '../firebase/stats-schema.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';

type SetupPhase = 'configure' | 'playing';

export type AiOfficerTier = WarpSkillLevel | 'class1-star';

interface LocalLaunchSession {
  readonly config: LocalGameConfig;
  readonly seed: number;
  readonly roster: ReadonlyMap<string, WarpAiPlayer>;
}

function applyAiTierOverrides(
  aiCaptains: readonly AiCaptainConfig[],
  tiers: Record<string, AiOfficerTier>
): AiCaptainConfig[] {
  return aiCaptains.map((ai) => {
    const tier = tiers[ai.id] ?? ai.skill;
    if (tier === 'class1-star') {
      return { ...ai, skill: 'commander', class1Star: true };
    }
    return { ...ai, skill: tier, class1Star: false };
  });
}

function ratedObjective(objective: GameObjective): RatedObjective | null {
  return objective === 'go-out' || objective === 'points' ? objective : null;
}

function skillOptionLabel(
  skill: WarpSkillLevel,
  objective: RatedObjective
): string {
  return formatAiSkillRatedLabel(
    skill,
    opponentTeiForObjective(objective, skill)
  );
}

export function LocalGamePage() {
  const [phase, setPhase] = useState<SetupPhase>('configure');
  const [humanName, setHumanName] = useState('Picard');
  const [playerCount, setPlayerCount] = useState(4);
  const [objective, setObjective] = useState<GameObjective>(DEFAULT_GAME_OBJECTIVE);
  const [campaignRounds, setCampaignRounds] = useState(DEFAULT_CAMPAIGN_ROUNDS);
  const [salamander, setSalamander] = useState(
    WARP12_OFFICIAL_MODULES.salamanderPenalty ?? true
  );
  const [qContinuum, setQContinuum] = useState(
    WARP12_OFFICIAL_MODULES.qContinuum ?? true
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
  const [academySaving, setAcademySaving] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);

  const applyOfficialWarp12Rules = () => {
    setObjective(WARP12_OFFICIAL_OBJECTIVE);
    setCampaignRounds(WARP12_OFFICIAL_CAMPAIGN_ROUNDS);
    setSalamander(WARP12_OFFICIAL_MODULES.salamanderPenalty ?? true);
    setQContinuum(WARP12_OFFICIAL_MODULES.qContinuum ?? true);
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
    () => buildAiCaptains(clampLocalPlayerCount(playerCount) - 1),
    [playerCount]
  );
  const aiCount = aiCaptains.length;
  const configuredAiCaptains = useMemo(
    () => applyAiTierOverrides(aiCaptains, aiTiers),
    [aiCaptains, aiTiers]
  );
  const matchSkill = useMemo(
    () => classifyLocalAiMatchSkill(configuredAiCaptains),
    [configuredAiCaptains]
  );
  const rated = ratedObjective(objective);
  const playerTei =
    rated && playerStats.ready
      ? playerStats.displayTei(matchSkill, rated)
      : null;

  const game = useMemo(() => {
    if (!launchSession) return null;
    return createLocalGame(launchSession.config, launchSession.seed);
  }, [launchSession]);

  const startSession = (config: LocalGameConfig, seed: number) => {
    setLaunchError(null);
    setLaunchSession({
      config,
      seed,
      roster: buildAiRoster(config, seed),
    });
    setPhase('playing');
  };

  const launch = () => {
    const count = clampLocalPlayerCount(playerCount);
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
        qContinuum,
        subspaceFracture,
        subspaceFractureScope,
      },
      houseRules,
      aiCaptains: applyAiTierOverrides(buildAiCaptains(count - 1), aiTiers),
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
          Fleet size ({LOCAL_MIN_PLAYERS}–{LOCAL_MAX_PLAYERS} captains)
        </span>
        <select
          aria-label="Fleet size"
          value={playerCount}
          onChange={(e) => setPlayerCount(Number(e.target.value))}
        >
          {Array.from(
            { length: LOCAL_MAX_PLAYERS - LOCAL_MIN_PLAYERS + 1 },
            (_, index) => LOCAL_MIN_PLAYERS + index
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
            checked={qContinuum}
            onChange={(e) => setQContinuum(e.target.checked)}
          />
          <span>Module Alpha — Q-Continuum</span>
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

      {rated &&
        playerStats.ready &&
        playerStats.needsAcademyPlacementForObjective(rated) && (
        <AcademyPlacementFieldset
          objective={rated}
          saving={academySaving}
          onSave={async (skill) => {
            setAcademySaving(true);
            try {
              await playerStats.saveAcademyPlacement(rated, skill);
            } finally {
              setAcademySaving(false);
            }
          }}
        />
      )}

      {rated &&
        playerStats.ready &&
        !playerStats.needsAcademyPlacementForObjective(rated) && (
        <fieldset className={styles.fieldset}>
          <legend>Solo TEI ({TEI_OBJECTIVE_LABEL[rated]})</legend>
          {playerTei !== null ? (
            <p className={styles.hint}>
              Your TEI vs {formatTacticalClass(aiSkillToTacticalClass(matchSkill))}{' '}
              officers: <strong>{playerTei}</strong>
              {' · '}
              reference {formatTei(opponentTeiForObjective(rated, matchSkill), true)}
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
        {aiCaptains.map((ai) => (
          <div key={ai.id} className={styles.aiRow}>
            <span className={styles.aiName}>{ai.displayName}</span>
            <select
              aria-label={`${ai.displayName} tactical class`}
              value={
                aiTiers[ai.id] ??
                (ai.class1Star ? 'class1-star' : ai.skill)
              }
              onChange={(e) =>
                setAiTiers((current) => ({
                  ...current,
                  [ai.id]: e.target.value as AiOfficerTier,
                }))
              }
            >
              {rated ? (
                <>
                  <option value="ensign">
                    {skillOptionLabel('ensign', rated)}
                  </option>
                  <option value="lieutenant">
                    {skillOptionLabel('lieutenant', rated)}
                  </option>
                  <option value="commander">
                    {skillOptionLabel('commander', rated)}
                  </option>
                  <option value="class1-star">
                    {CLASS1_STAR_DISPLAY_NAME} (experimental)
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
                  <option value="class1-star">
                    {CLASS1_STAR_DISPLAY_NAME} (experimental)
                  </option>
                </>
              )}
            </select>
          </div>
        ))}
      </fieldset>

      <div className={styles.actions}>
        {launchError ? (
          <p className={styles.hint} role="alert">
            {launchError}
          </p>
        ) : null}
        <button type="button" className={styles.primary} onClick={launch}>
          Launch simulation
        </button>
      </div>
    </section>
  );
}

export default LocalGamePage;
