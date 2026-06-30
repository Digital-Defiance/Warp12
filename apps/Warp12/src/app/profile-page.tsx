import { Link } from 'react-router-dom';

import {
  aiSkillToTacticalClass,
  formatTacticalClass,
  formatTei,
  teiToPlayerTacticalClass,
  WARP_SKILL_LEVELS,
  type WarpSkillLevel,
} from 'warp12-engine';

import {
  recentDecisionTrend,
  recentTeiTrend,
} from '../firebase/match-history.js';
import { opponentTeiForObjective } from '../firebase/stats-elo.js';
import {
  displayPlayerObjectiveTei,
  type PlayerStatsDocument,
} from '../firebase/stats-service.js';
import { objectiveTeiStats, type RatedObjective } from '../firebase/stats-schema.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { isFirebaseConfigured } from '../firebase/config.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import { AcademyPlacementFieldset } from './academy-placement-fieldset';
import styles from './lobby.module.scss';
import profileStyles from './profile-page.module.scss';

function TrendChart({
  title,
  points,
  suffix = '',
}: {
  title: string;
  points: readonly { label: string; value: number }[];
  suffix?: string;
}) {
  if (points.length === 0) {
    return (
      <div className={profileStyles.trendBlock}>
        <h3 className={profileStyles.trendTitle}>{title}</h3>
        <p className={styles.hint}>Play a few rated matches to see trends.</p>
      </div>
    );
  }

  const max = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className={profileStyles.trendBlock}>
      <h3 className={profileStyles.trendTitle}>{title}</h3>
      <div className={profileStyles.trendChart} aria-hidden>
        {points.map((point) => (
          <div key={point.label} className={profileStyles.trendBarWrap}>
            <div
              className={profileStyles.trendBar}
              style={{ height: `${Math.max(8, (point.value / max) * 100)}%` }}
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
            <td>{formatTacticalClass(aiSkillToTacticalClass(row.skill))}</td>
            <td>
              {row.tei != null ? (
                <>
                  {row.tei}
                  {' · '}
                  {formatTacticalClass(teiToPlayerTacticalClass(row.tei), {
                    short: true,
                  })}
                </>
              ) : (
                '—'
              )}
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
  const configured = isFirebaseConfigured();

  if (!configured) {
    return (
      <section className={`${styles.lobby} ${styles.lobbyWide}`}>
        <p className={styles.hint}>Firebase is not configured — solo TEI is unavailable.</p>
        <Link to="/">← Back</Link>
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
        <p className={styles.hint}>Sign in required for solo TEI and match history.</p>
        <Link to="/">← Back</Link>
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
        Tactical Efficiency Index, decision-quality trends, and recent local-AI
        matches.
      </p>

      {playerStats.needsAcademyPlacementForObjective('go-out') && (
        <AcademyPlacementFieldset
          objective="go-out"
          onSave={(skill, tei) =>
            playerStats.saveAcademyPlacement('go-out', skill, tei)
          }
        />
      )}

      {playerStats.needsAcademyPlacementForObjective('penalty') && (
        <AcademyPlacementFieldset
          objective="penalty"
          onSave={(skill, tei) =>
            playerStats.saveAcademyPlacement('penalty', skill, tei)
          }
        />
      )}

      {stats ? (
        <>
          <fieldset className={styles.fieldset}>
            <legend>Go-out TEI</legend>
            <TeiTable stats={stats} objective="go-out" />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Penalty TEI</legend>
            <TeiTable stats={stats} objective="penalty" />
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
            />
            <TrendChart
              title="Penalty TEI (unassisted)"
              points={recentTeiTrend(history, 'penalty')}
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
                    {entry.objective} vs{' '}
                    {formatTacticalClass(
                      aiSkillToTacticalClass(entry.opponentSkill)
                    )}
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
