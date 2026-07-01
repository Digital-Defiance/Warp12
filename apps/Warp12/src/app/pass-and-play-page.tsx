import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  DEFAULT_CAMPAIGN_ROUNDS,
  DEFAULT_GAME_OBJECTIVE,
  DEFAULT_SUBSPACE_FRACTURE_SCOPE,
  type GameObjective,
  type HouseRulesConfig,
  type SubspaceFractureScope,
  type WarpAiPlayer,
} from 'warp12-engine';

import { BridgeTable } from './bridge-table';
import styles from './lobby.module.scss';
import { CampaignRoundsField, ObjectivePicker } from './objective-picker';
import { HouseRulesOptions } from './house-rules-options';
import { SubspaceFractureOptions } from './subspace-fracture-options';
import { buildAiRoster, createLocalGame } from '../game/create-local-game.js';
import {
  buildAiCaptains,
  buildHumanCaptains,
  clampPassAndPlayPlayerCount,
  DEFAULT_HUMAN_CAPTAIN_NAMES,
  LOCAL_MAX_PLAYERS,
  PASS_AND_PLAY_MIN_PLAYERS,
  type LocalGameConfig,
} from '../game/local-game-config.js';
import { drawMatchSeed } from '../game/match-seed.js';

type SetupPhase = 'configure' | 'playing';

interface PassAndPlayLaunchSession {
  readonly config: LocalGameConfig;
  readonly seed: number;
  readonly roster: ReadonlyMap<string, WarpAiPlayer>;
}

export function PassAndPlayPage() {
  const [phase, setPhase] = useState<SetupPhase>('configure');
  const [playerCount, setPlayerCount] = useState(4);
  const [humanNames, setHumanNames] = useState<string[]>(() =>
    DEFAULT_HUMAN_CAPTAIN_NAMES.slice(0, 4).map((name) => name)
  );
  const [aiFillCount, setAiFillCount] = useState(0);
  const [objective, setObjective] = useState<GameObjective>(DEFAULT_GAME_OBJECTIVE);
  const [campaignRounds, setCampaignRounds] = useState(DEFAULT_CAMPAIGN_ROUNDS);
  const [salamander, setSalamander] = useState(false);
  const [qContinuum, setQContinuum] = useState(false);
  const [subspaceFracture, setSubspaceFracture] = useState(false);
  const [subspaceFractureScope, setSubspaceFractureScope] =
    useState<SubspaceFractureScope>(DEFAULT_SUBSPACE_FRACTURE_SCOPE);
  const [houseRules, setHouseRules] = useState<HouseRulesConfig>({});
  const [launchSession, setLaunchSession] = useState<PassAndPlayLaunchSession | null>(
    null
  );

  const cappedCount = clampPassAndPlayPlayerCount(playerCount);
  const humanCount = cappedCount - aiFillCount;
  const aiCount = aiFillCount;

  const syncPlayerCount = (count: number) => {
    const next = clampPassAndPlayPlayerCount(count);
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

  const configuredHumanNames = useMemo(
    () => humanNames.slice(0, humanCount),
    [humanCount, humanNames]
  );

  const game = useMemo(() => {
    if (!launchSession) return null;
    return createLocalGame(launchSession.config, launchSession.seed);
  }, [launchSession]);

  const startSession = (config: LocalGameConfig, seed: number) => {
    setLaunchSession({
      config,
      seed,
      roster: buildAiRoster(config, seed),
    });
    setPhase('playing');
  };

  const launch = () => {
    const count = clampPassAndPlayPlayerCount(playerCount);
    const humans = buildHumanCaptains(humanCount, configuredHumanNames);
    const primary = humans[0];
    const next: LocalGameConfig = {
      humanId: primary.id,
      humanName: primary.displayName,
      humanCaptains: humans,
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
      aiCaptains: buildAiCaptains(aiCount),
    };
    startSession(next, drawMatchSeed());
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

      <label className={styles.field}>
        <span>
          Fleet size ({PASS_AND_PLAY_MIN_PLAYERS}–{LOCAL_MAX_PLAYERS} captains)
        </span>
        <select
          aria-label="Fleet size"
          value={playerCount}
          onChange={(e) => syncPlayerCount(Number(e.target.value))}
        >
          {Array.from(
            { length: LOCAL_MAX_PLAYERS - PASS_AND_PLAY_MIN_PLAYERS + 1 },
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

      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={launch}>
          Launch table
        </button>
      </div>
    </section>
  );
}

export default PassAndPlayPage;
