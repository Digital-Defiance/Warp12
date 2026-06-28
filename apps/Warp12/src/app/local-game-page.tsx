import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  type GameObjective,
  type WarpSkillLevel,
} from 'warp12-engine';

import { BridgeTable } from './bridge-table';
import styles from './lobby.module.scss';
import { ObjectivePicker } from './objective-picker';
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

type SetupPhase = 'configure' | 'playing';

function applyAiOverrides(
  aiCaptains: readonly AiCaptainConfig[],
  skills: Record<string, WarpSkillLevel>,
  lookahead: Record<string, boolean>
): AiCaptainConfig[] {
  return aiCaptains.map((ai) => ({
    ...ai,
    skill: skills[ai.id] ?? ai.skill,
    useLookahead: lookahead[ai.id] ?? ai.useLookahead ?? false,
  }));
}

export function LocalGamePage() {
  const [phase, setPhase] = useState<SetupPhase>('configure');
  const [humanName, setHumanName] = useState('Picard');
  const [playerCount, setPlayerCount] = useState(4);
  const [objective, setObjective] = useState<GameObjective>('go-out');
  const [salamander, setSalamander] = useState(false);
  const [qContinuum, setQContinuum] = useState(false);
  const [subspaceFracture, setSubspaceFracture] = useState(false);
  const [aiSkills, setAiSkills] = useState<Record<string, WarpSkillLevel>>({});
  const [aiLookahead, setAiLookahead] = useState<Record<string, boolean>>({});

  const [launchSeed, setLaunchSeed] = useState(() => Date.now());
  const [activeConfig, setActiveConfig] = useState<LocalGameConfig | null>(
    null
  );

  const aiCaptains = useMemo(
    () => buildAiCaptains(clampLocalPlayerCount(playerCount) - 1),
    [playerCount]
  );
  const aiCount = aiCaptains.length;

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
      modules: {
        salamanderPenalty: salamander,
        qContinuum,
        subspaceFracture,
      },
      aiCaptains: applyAiOverrides(buildAiCaptains(count - 1), aiSkills, aiLookahead),
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
        <label className={styles.checkboxRow}>
          <input
            type="checkbox"
            checked={subspaceFracture}
            onChange={(e) => setSubspaceFracture(e.target.checked)}
          />
          <span>Subspace Fracture (chicken foot on doubles)</span>
        </label>
      </fieldset>

      <fieldset className={styles.fieldset}>
        <legend>
          AI officers ({aiCaptains.length})
        </legend>
        {aiCaptains.map((ai) => (
          <div key={ai.id} className={styles.aiRow}>
            <span className={styles.aiName}>{ai.displayName}</span>
            <select
              aria-label={`${ai.displayName} skill level`}
              value={aiSkills[ai.id] ?? ai.skill}
              onChange={(e) =>
                setAiSkills((current) => ({
                  ...current,
                  [ai.id]: e.target.value as WarpSkillLevel,
                }))
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={aiLookahead[ai.id] ?? ai.useLookahead ?? false}
                onChange={(e) =>
                  setAiLookahead((current) => ({
                    ...current,
                    [ai.id]: e.target.checked,
                  }))
                }
              />
              <span>Lookahead</span>
            </label>
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
