import { Link } from 'react-router-dom';

import type { RatedObjective, WarpSkillLevel } from 'warp12-engine';

import {
  recentDecisionTrend,
  recentEloTrend,
} from '../firebase/match-history.js';
import { opponentEloForObjective } from '../firebase/stats-elo.js';
import {
  displayPlayerObjectiveElo,
  type PlayerStatsDocument,
} from '../firebase/stats-service.js';
import { objectiveEloStats } from '../firebase/stats-schema.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { isFirebaseConfigured } from '../firebase/config.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import styles from './lobby.module.scss';
import profileStyles from './profile-page.module.scss';

const SKILL_LABELS: Record<WarpSkillLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

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

function EloTable({
  stats,
  objective,
}: {
  stats: PlayerStatsDocument;
  objective: RatedObjective;
}) {
  const rows = (['beginner', 'intermediate', 'advanced'] as const).map(
    (skill) => ({
      skill,
      elo: displayPlayerObjectiveElo(stats, skill, objective),
      opponent: opponentEloForObjective(objective, skill),
      matches: objectiveEloStats(stats.localAi?.[skill] ?? {}, objective)
        .unassistedMatches,
    })
  );

  return (
    <table className={profileStyles.table}>
      <thead>
        <tr>
          <th>Opponent tier</th>
          <th>Your ELO</th>
          <th>Opponent rating</th>
          <th>Rated games</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.skill}>
            <td>{SKILL_LABELS[row.skill]}</td>
            <td>{row.elo ?? '—'}</td>
            <td>~{row.opponent}</td>
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
        <p className={styles.hint}>Firebase is not configured — solo ratings are unavailable.</p>
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
        <p className={styles.hint}>Sign in required for solo ratings and match history.</p>
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
        Solo ratings, decision-quality trends, and recent local-AI matches.
      </p>

      {stats ? (
        <>
          <fieldset className={styles.fieldset}>
            <legend>Go-out solo ratings</legend>
            <EloTable stats={stats} objective="go-out" />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Penalty solo ratings</legend>
            <EloTable stats={stats} objective="penalty" />
          </fieldset>

          <div className={profileStyles.trendGrid}>
            <TrendChart
              title="Decision quality (recent matches)"
              points={recentDecisionTrend(history)}
              suffix="%"
            />
            <TrendChart
              title="Go-out ELO (unassisted)"
              points={recentEloTrend(history, 'go-out')}
            />
            <TrendChart
              title="Penalty ELO (unassisted)"
              points={recentEloTrend(history, 'penalty')}
            />
          </div>

          <fieldset className={styles.fieldset}>
            <legend>Recent matches</legend>
            {history.length === 0 ? (
              <p className={styles.hint}>No matches recorded yet.</p>
            ) : (
              <ul className={profileStyles.historyList}>
                {history.slice(0, 15).map((entry, index) => (
                  <li key={`${entry.playedAt}-${index}`}>
                    {new Date(entry.playedAt).toLocaleDateString()} ·{' '}
                    {entry.objective} vs {entry.opponentSkill}{' '}
                    {entry.won ? 'win' : 'loss'}
                    {entry.advisorUsed ? ' · advisor' : ''}
                    {entry.decisionGrade
                      ? ` · ${entry.decisionGrade} (${entry.decisionPct}%)`
                      : ''}
                    {entry.eloDelta !== undefined
                      ? ` · ELO ${entry.eloDelta > 0 ? '+' : ''}${entry.eloDelta}`
                      : ''}
                  </li>
                ))}
              </ul>
            )}
          </fieldset>
        </>
      ) : (
        <p className={styles.hint}>
          No stats yet — finish a local vs-AI match while signed in.
        </p>
      )}
    </section>
  );
}

export default ProfilePage;
