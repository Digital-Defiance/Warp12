import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  aiSkillToTacticalClass,
  formatAiSkillRatedLabel,
  formatAiSkillUnratedLabel,
  formatTacticalClass,
  formatTei,
  type GameObjective,
  type HouseRulesConfig,
  type SubspaceFractureScope,
  type WarpSkillLevel,
} from 'warp12-engine';

import { AcademyPlacementFieldset } from './academy-placement-fieldset';
import { BridgeTable } from './bridge-table';
import styles from './lobby.module.scss';
import { CampaignRoundsField, ObjectivePicker } from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { SubspaceFractureOptions } from './subspace-fracture-options';
import {
  buildAiRoster,
  createLocalGame,
} from '../game/create-local-game.js';
import {
  buildAiCaptains,
  clampLocalPlayerCount,
  LOCAL_MAX_PLAYERS,
  LOCAL_MIN_PLAYERS,
  type AiCaptainConfig,
  type LocalGameConfig,
} from '../game/local-game-config.js';
import { classifyLocalAiMatchSkill } from '../game/local-match-stats.js';
import { opponentTeiForObjective } from '../firebase/stats-elo.js';
import type { RatedObjective } from '../firebase/stats-schema.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';

type SetupPhase = 'configure' | 'playing';

function applyAiOverrides(
  aiCaptains: readonly AiCaptainConfig[],
  skills: Record<string, WarpSkillLevel>
): AiCaptainConfig[] {
  return aiCaptains.map((ai) => ({
    ...ai,
    skill: skills[ai.id] ?? ai.skill,
  }));
}

function ratedObjective(objective: GameObjective): RatedObjective | null {
  return objective === 'go-out' || objective === 'penalty' ? objective : null;
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
  const [objective, setObjective] = useState<GameObjective>('go-out');
  const [campaignRounds, setCampaignRounds] = useState(DEFAULT_CAMPAIGN_ROUNDS);
  const [salamander, setSalamander] = useState(false);
  const [qContinuum, setQContinuum] = useState(false);
  const [subspaceFracture, setSubspaceFracture] = useState(false);
  const [subspaceFractureScope, setSubspaceFractureScope] =
    useState<SubspaceFractureScope>(DEFAULT_SUBSPACE_FRACTURE_SCOPE);
  const [houseRules, setHouseRules] = useState<HouseRulesConfig>({});
  const [aiSkills, setAiSkills] = useState<Record<string, WarpSkillLevel>>({});
  const [academySaving, setAcademySaving] = useState(false);

  const playerStats = usePlayerStats();

  const [launchSeed, setLaunchSeed] = useState(() => Date.now());
  const [activeConfig, setActiveConfig] = useState<LocalGameConfig | null>(
    null
  );

  const aiCaptains = useMemo(
    () => buildAiCaptains(clampLocalPlayerCount(playerCount) - 1),
    [playerCount]
  );
  const aiCount = aiCaptains.length;
  const configuredAiCaptains = useMemo(
    () => applyAiOverrides(aiCaptains, aiSkills),
    [aiCaptains, aiSkills]
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

  const aiRoster = useMemo(() => {
    if (!activeConfig) return null;
    return buildAiRoster(activeConfig, launchSeed);
  }, [activeConfig, launchSeed]);

  const game = useMemo(() => {
    if (!activeConfig) return null;
    return createLocalGame(activeConfig, launchSeed);
  }, [activeConfig, launchSeed]);

  const launch = () => {
    const count = clampLocalPlayerCount(playerCount);
    const next: LocalGameConfig = {
      humanId: 'you',
      humanName: humanName.trim() || 'You',
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
      aiCaptains: applyAiOverrides(buildAiCaptains(count - 1), aiSkills),
    };
    const seed = Date.now();
    setLaunchSeed(seed);
    setActiveConfig(next);
    setPhase('playing');
  };

  const rematch = () => {
    if (!activeConfig) return;
    setLaunchSeed(Date.now());
  };

  if (phase === 'playing' && game && activeConfig && aiRoster) {
    return (
      <BridgeTable
        mode="local"
        game={game}
        key={launchSeed}
        localConfig={activeConfig}
        aiPlayers={aiRoster}
        onRematch={rematch}
        onLeaveSetup={() => setPhase('configure')}
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

      {objective === 'penalty' && (
        <fieldset className={styles.fieldset}>
          <legend>Campaign length</legend>
          <CampaignRoundsField
            value={campaignRounds}
            onChange={setCampaignRounds}
          />
        </fieldset>
      )}

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
          onSave={async (skill, tei) => {
            setAcademySaving(true);
            try {
              await playerStats.saveAcademyPlacement(rated, skill, tei);
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
          <legend>Solo TEI ({rated === 'go-out' ? 'go-out' : 'penalty'})</legend>
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
              value={aiSkills[ai.id] ?? ai.skill}
              onChange={(e) =>
                setAiSkills((current) => ({
                  ...current,
                  [ai.id]: e.target.value as WarpSkillLevel,
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
          </div>
        ))}
      </fieldset>

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={launch}>
          Launch simulation
        </button>
      </div>
    </section>
  );
}

export default LocalGamePage;
