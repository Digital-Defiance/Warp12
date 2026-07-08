import { Link } from 'react-router-dom';

import {
  aiSkillToTacticalClass,
  CLASS1_STAR_DISPLAY_NAME,
  formatAiOfficerTacticalClass,
  formatTacticalClass,
  formatTei,
  TEI_OBJECTIVE_LABEL,
  teiToPlayerTacticalClass,
  WARP_SKILL_LEVELS,
} from 'warp12-engine';

import {
  recentDecisionTrend,
  recentTeiTrend,
} from '../firebase/match-history.js';
import {
  isProvisionalTei,
  opponentTeiForObjective,
  PROVISIONAL_TEI_MATCHES,
} from '../firebase/stats-elo.js';
import { displayPlayerObjectiveTei } from '../firebase/stats-service.js';
import { displayHumanObjectiveTei, humanObjectiveTeiStats } from '../firebase/human-tei.js';
import {
  objectiveTeiStats,
  type MatchHistoryEntry,
  type PlayerStatsDocument,
  type RatedObjective,
} from '../firebase/stats-schema.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { isFirebaseConfigured } from '../firebase/config.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import { useCaptainProfile } from '../game/use-captain-profile.js';
import { AccountUpgradeFieldset } from './account-upgrade-fieldset.js';
import { AcademyPlacementFieldset } from './academy-placement-fieldset';
import { CaptainGenderFieldset } from './captain-gender-fieldset';
import styles from './lobby.module.scss';
import profileStyles from './profile-page.module.scss';

function TrendChart({
  title,
  points,
  suffix = '',
  relativeScale = false,
}: {
  title: string;
  points: readonly { label: string; value: number }[];
  suffix?: string;
  /** Scale bars to min–max in the series (TEI trends). */
  relativeScale?: boolean;
}) {
  if (points.length === 0) {
    return (
      <div className={profileStyles.trendBlock}>
        <h3 className={profileStyles.trendTitle}>{title}</h3>
        <p className={styles.hint}>Play a few rated matches to see trends.</p>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = relativeScale ? Math.max(max - min, 1) : Math.max(max, 1);

  const barHeight = (value: number): number => {
    if (relativeScale) {
      if (max === min) {
        return 72;
      }
      return Math.max(8, ((value - min) / span) * 100);
    }
    return Math.max(8, (value / span) * 100);
  };

  return (
    <div className={profileStyles.trendBlock}>
      <h3 className={profileStyles.trendTitle}>{title}</h3>
      <div className={profileStyles.trendChart} aria-hidden>
        {points.map((point) => (
          <div key={point.label} className={profileStyles.trendBarWrap}>
            <div
              className={profileStyles.trendBar}
              style={{ height: `${barHeight(point.value)}%` }}
            />
            <span className={profileStyles.trendLabel}>{point.label}</span>
          </div>
        ))}
      </div>
      <p className={styles.hint}>
        Latest: {points[points.length - 1]?.value}
        {suffix}
      </p>
    </div>
  );
}

function formatMatchOpponentLabel(entry: MatchHistoryEntry): string {
  if (entry.opponentContext === 'human') {
    const count = entry.playerCount ?? 2;
    const rank = entry.finishRank ?? (entry.won ? 1 : count);
    return `${count} captains (rank ${rank})`;
  }
  if (!entry.opponentSkill) {
    return 'Unknown opponent';
  }
  return formatAiOfficerTacticalClass(entry.opponentSkill, {
    omega: entry.opponentOmega,
    class1Star: entry.opponentClass1Star,
  });
}

function RatingBadge({ matches }: { matches: number }) {
  if (matches <= 0) {
    return null;
  }
  if (isProvisionalTei(matches)) {
    const label = `Provisional — settles after ${PROVISIONAL_TEI_MATCHES} rated games (${matches}/${PROVISIONAL_TEI_MATCHES})`;
    return (
      <span className={profileStyles.provisionalBadge} title={label}>
        <img
          src="/badge-sharp-duotone-light-full.svg"
          alt=""
          aria-hidden
          className={profileStyles.badgeIcon}
        />
        Provisional {matches}/{PROVISIONAL_TEI_MATCHES}
      </span>
    );
  }
  return (
    <span
      className={profileStyles.establishedBadge}
      title={`Established rating — ${matches} rated games (${PROVISIONAL_TEI_MATCHES}+)`}
    >
      <img
        src="/badge-check-duotone-light-full.svg"
        alt=""
        aria-hidden
        className={profileStyles.badgeIcon}
      />
      Established
    </span>
  );
}

function TeiCell({
  tei,
  matches,
}: {
  tei: number | null;
  matches: number;
}) {
  if (tei == null) {
    return <>—</>;
  }
  return (
    <>
      {tei}
      {' · '}
      {formatTacticalClass(teiToPlayerTacticalClass(tei), { short: true })}
      <RatingBadge matches={matches} />
    </>
  );
}

function HumanTeiTable({
  stats,
  objective,
}: {
  stats: PlayerStatsDocument;
  objective: RatedObjective;
}) {
  const track = humanObjectiveTeiStats(stats, objective);
  const tei = displayHumanObjectiveTei(stats, objective);

  return (
    <table className={profileStyles.table}>
      <thead>
        <tr>
          <th>Pool</th>
          <th>Your TEI</th>
          <th>Rated games</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Online human opponents</td>
          <td>
            <TeiCell tei={tei} matches={track.unassistedMatches} />
          </td>
          <td>{track.unassistedMatches}</td>
        </tr>
      </tbody>
    </table>
  );
}

function TeiTable({
  stats,
  objective,
}: {
  stats: PlayerStatsDocument;
  objective: RatedObjective;
}) {
  const rows = WARP_SKILL_LEVELS.map((skill) => ({
    skill,
    tei: displayPlayerObjectiveTei(stats, skill, objective),
    opponent: opponentTeiForObjective(objective, skill),
    matches: objectiveTeiStats(stats.localAi?.[skill] ?? {}, objective)
      .unassistedMatches,
  }));

  return (
    <table className={profileStyles.table}>
      <thead>
        <tr>
          <th>Opponent profile</th>
          <th>Your TEI</th>
          <th>Reference TEI</th>
          <th>Rated games</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.skill}>
            <td>
              {row.skill === 'commander'
                ? `${formatTacticalClass('II')} / ${CLASS1_STAR_DISPLAY_NAME}`
                : formatTacticalClass(aiSkillToTacticalClass(row.skill))}
            </td>
            <td>
              <TeiCell tei={row.tei} matches={row.matches} />
            </td>
            <td>{formatTei(row.opponent, true)}</td>
            <td>{row.matches}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProfilePage() {
  const auth = useFirebaseAuth();
  const playerStats = usePlayerStats();
  const { gender: captainGender, setCaptainGender } = useCaptainProfile();
  const configured = isFirebaseConfigured();

  const captainAvatarFieldset = (
    <CaptainGenderFieldset
      gender={captainGender}
      onChange={(next) => void setCaptainGender(next)}
      disabled={!playerStats.ready}
    />
  );

  if (!configured) {
    return (
      <section className={`${styles.lobby} ${styles.lobbyWide}`}>
        <p className={styles.backLink}>
          <Link to="/">← Back to bridge</Link>
        </p>
        <h2 className={styles.title}>Captain profile</h2>
        {captainAvatarFieldset}
        <p className={styles.hint}>Firebase is not configured — solo TEI is unavailable.</p>
      </section>
    );
  }

  if (!auth.ready || !playerStats.ready) {
    return (
      <section className={`${styles.lobby} ${styles.lobbyWide}`}>
        <p className={styles.hint}>Loading captain profile…</p>
      </section>
    );
  }

  if (!auth.user) {
    return (
      <section className={`${styles.lobby} ${styles.lobbyWide}`}>
        <p className={styles.backLink}>
          <Link to="/">← Back to bridge</Link>
        </p>
        <h2 className={styles.title}>Captain profile</h2>
        {captainAvatarFieldset}
        <p className={styles.hint}>Sign in for solo TEI and match history.</p>
      </section>
    );
  }

  const stats = playerStats.stats;
  const history = stats?.matchHistory ?? [];
  const displayName = stats?.displayName ?? 'Captain';

  return (
    <section className={`${styles.lobby} ${styles.lobbyWide}`}>
      <p className={styles.backLink}>
        <Link to="/">← Back to bridge</Link>
      </p>
      <h2 className={styles.title}>{displayName}</h2>
      <p className={styles.subtitle}>
        Tactical Efficiency Index — reference-AI tracks, human-opponent pool,
        decision-quality trends, and recent matches.
      </p>
      <p className={styles.hint}>
        Ratings are <strong>Provisional</strong> for your first{' '}
        {PROVISIONAL_TEI_MATCHES} rated games in a track (they swing more while
        the system learns your strength), then become{' '}
        <strong>Established</strong> and settle down.
      </p>

      {captainAvatarFieldset}

      {auth.user && (
        <AccountUpgradeFieldset
          user={auth.user}
          onUpgraded={async () => {
            await auth.user?.getIdToken(true);
            await playerStats.refresh();
          }}
        />
      )}

      {playerStats.needsAcademyPlacementForObjective('go-out') && (
        <AcademyPlacementFieldset
          objective="go-out"
          onSave={(skill) =>
            playerStats.saveAcademyPlacement('go-out', skill)
          }
        />
      )}

      {playerStats.needsAcademyPlacementForObjective('points') && (
        <AcademyPlacementFieldset
          objective="points"
          onSave={(skill) =>
            playerStats.saveAcademyPlacement('points', skill)
          }
        />
      )}

      {stats ? (
        <>
          <fieldset className={styles.fieldset}>
            <legend>Go-out TEI (reference AI)</legend>
            <TeiTable stats={stats} objective="go-out" />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Points TEI (reference AI)</legend>
            <TeiTable stats={stats} objective="points" />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Go-out TEI (human pool)</legend>
            <HumanTeiTable stats={stats} objective="go-out" />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Points TEI (human pool)</legend>
            <HumanTeiTable stats={stats} objective="points" />
          </fieldset>

          <div className={profileStyles.trendGrid}>
            <TrendChart
              title="Decision quality (recent matches)"
              points={recentDecisionTrend(history)}
              suffix="%"
            />
            <TrendChart
              title="Go-out TEI (unassisted)"
              points={recentTeiTrend(history, 'go-out')}
              relativeScale
            />
            <TrendChart
              title="Points TEI (unassisted)"
              points={recentTeiTrend(history, 'points')}
              relativeScale
            />
          </div>

          <fieldset className={styles.fieldset}>
            <legend>Recent matches</legend>
            {history.length === 0 ? (
              <p className={styles.hint}>No matches recorded yet.</p>
            ) : (
              <ul className={profileStyles.historyList}>
                {history.map((entry) => (
                  <li key={entry.playedAt}>
                    {TEI_OBJECTIVE_LABEL[entry.objective]} vs{' '}
                    {formatMatchOpponentLabel(entry)}
                    {' — '}
                    {entry.won ? 'won' : 'lost'}
                    {entry.advisorUsed ? ' · advisor' : ''}
                    {entry.teiAfter != null ? ` · TEI ${entry.teiAfter}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </>
      ) : (
        <p className={styles.hint}>No stats on file yet.</p>
      )}
    </section>
  );
}

export default ProfilePage;
