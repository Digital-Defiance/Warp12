import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';

import {
  aiSkillToTacticalClass,
  CLASS1_STAR_DISPLAY_NAME,
  formatAiOfficerTacticalClass,
  formatTacticalClass,
  formatTei,
  getTeiDisplay,
  isTeiProvisional,
  TEI_OBJECTIVE_LABEL,
  WARP_SKILL_LEVELS,
  type WarpSkillLevel,
} from 'warp12-engine';

import {
  recentDecisionTrend,
  recentTeiTrend,
} from '../firebase/match-history.js';
import {
  opponentTeiForObjective,
  getAIAnchorStored,
} from '../firebase/stats-openskill.js';
import { getPlayerStoredRating } from '../firebase/stats-service.js';
import {
  displayHumanObjectiveTei,
  humanObjectiveTeiStats,
  squadObjectiveTeiStats,
} from '../firebase/human-tei.js';
import {
  objectiveRatingStats as objectiveTeiStats,
  type MatchHistoryEntry,
  type PlayerStatsDocument,
  type RatedObjective,
  type StoredRating,
} from '../firebase/stats-schema.js';
import {
  listMySquadMatches,
  type SquadMatchView,
} from '../firebase/squad-matches.js';
import { useFirebaseAuth } from '../firebase/use-firebase-auth.js';
import { isFirebaseConfigured } from '../firebase/config.js';
import { usePlayerStats } from '../firebase/use-player-stats.js';
import { useCaptainProfile } from '../game/use-captain-profile.js';
import { readUserPrefs, writeUserPrefs } from './user-prefs.js';
import { AccountUpgradeFieldset } from './account-upgrade-fieldset.js';
import { AcademyPlacementFieldset } from './academy-placement-fieldset';
import { CaptainGenderFieldset } from './captain-gender-fieldset';
import { TeiDisplay } from './components/tei-display.js';
import { RatingHistoryChart } from './rating-history-chart.js';
import { SigmaDecayChart } from './sigma-decay-chart.js';
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

function TeiCell({
  rating,
  objective,
  showAdvanced,
}: {
  rating: StoredRating | null;
  objective: RatedObjective;
  showAdvanced?: boolean;
}) {
  if (!rating || rating.matches === 0) {
    return <span className={styles.hint}>—</span>;
  }

  return (
    <TeiDisplay
      rating={rating}
      currentGrade={rating.displayGrade}
      objective={objective}
      size="medium"
      showAdvanced={showAdvanced}
    />
  );
}

function HumanTeiTable({
  stats,
  objective,
  showAdvanced,
}: {
  stats: PlayerStatsDocument;
  objective: RatedObjective;
  showAdvanced?: boolean;
}) {
  const track = humanObjectiveTeiStats(stats, objective);
  
  // Get rating from new OpenSkill schema (humanRating) or fallback to constructing from old schema
  const rating: StoredRating | null = track.rating?.matches > 0 ? track.rating : null;

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
            {rating ? (
              <TeiCell
                rating={rating}
                objective={objective}
                showAdvanced={showAdvanced}
              />
            ) : (
              <span className={styles.hint}>—</span>
            )}
          </td>
          <td>{track.unassistedMatches}</td>
        </tr>
      </tbody>
    </table>
  );
}

/** Module Zeta: squad-play rating table (parallel to HumanTeiTable). */
function SquadTeiTable({
  stats,
  objective,
  showAdvanced,
}: {
  stats: PlayerStatsDocument;
  objective: RatedObjective;
  showAdvanced?: boolean;
}) {
  const track = squadObjectiveTeiStats(stats, objective);
  const rating: StoredRating | null = track.rating?.matches > 0 ? track.rating : null;

  if (!rating) {
    return null; // Hide the section entirely until the captain has a squad match.
  }

  return (
    <table className={profileStyles.table}>
      <thead>
        <tr>
          <th>Pool</th>
          <th>Your Squad TEI</th>
          <th>Rated squad matches</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Squad play (Module Zeta)</td>
          <td>
            <TeiCell rating={rating} objective={objective} showAdvanced={showAdvanced} />
          </td>
          <td>{rating.matches}</td>
        </tr>
      </tbody>
    </table>
  );
}

function formatSquadMatchLine(match: SquadMatchView): string {
  const parts = match.squadrons.map((s) => {
    const label = s.name ?? s.id;
    const members = s.memberDisplayNames.join(' & ');
    const won = match.winnerSquadIds.includes(s.id) ? '★ ' : '';
    return `${won}${label} (${members})`;
  });
  const when = match.playedAt.slice(0, 10);
  return `${when} · ${TEI_OBJECTIVE_LABEL[match.objective]} · ${parts.join(' vs ')}`;
}

function SquadMatchHistory({ uid }: { uid: string }) {
  const [matches, setMatches] = useState<SquadMatchView[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void listMySquadMatches(uid)
      .then((rows) => {
        if (!cancelled) {
          setMatches(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMatches([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  if (matches === null) {
    return <p className={styles.hint}>Loading squad match archive…</p>;
  }
  if (matches.length === 0) {
    return (
      <p className={styles.hint}>
        No archived squad sectors yet — rated Warp 12 Zeta finishes land here.
      </p>
    );
  }

  return (
    <ul className={profileStyles.historyList}>
      {matches.map((m) => (
        <li key={m.gameId}>{formatSquadMatchLine(m)}</li>
      ))}
    </ul>
  );
}

function TeiTable({
  stats,
  objective,
  showAdvanced,
}: {
  stats: PlayerStatsDocument;
  objective: RatedObjective;
  showAdvanced?: boolean;
}) {
  const rows = WARP_SKILL_LEVELS.map((skill) => {
    const trackStats = objectiveTeiStats(stats.localAi?.[skill] ?? {}, objective);
    const rating = getPlayerStoredRating(stats, skill, objective);
    const opponentRating = getAIAnchorStored(objective, skill);
    
    return {
      skill,
      rating,
      opponentRating,
      matches: trackStats.rating.matches,
    };
  });

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
              <TeiCell
                rating={row.rating}
                objective={objective}
                showAdvanced={showAdvanced}
              />
            </td>
            <td>
              <TeiCell
                rating={row.opponentRating}
                objective={objective}
                showAdvanced={showAdvanced}
              />
            </td>
            <td>{row.matches}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ProfilePage() {
  const [showAdvancedStats, setShowAdvancedStats] = useState(() => 
    readUserPrefs().showAdvancedStats
  );

  // Persist advanced stats preference when it changes
  useEffect(() => {
    writeUserPrefs({ showAdvancedStats });
  }, [showAdvancedStats]);

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
        Ratings show your <strong>TEI grade</strong> (letter = confidence, number =
        skill) and a derived <strong>federation commission</strong> (Cadet through
        Fleet Admiral). Hover for a plain-language readout. See{' '}
        <Link to="/tei">How TEI works</Link> for the full story — including OpenSkill
        for curious captains.
      </p>

      <div className={profileStyles.advancedToggle}>
        <label className={profileStyles.advancedCheck}>
          <input
            type="checkbox"
            checked={showAdvancedStats}
            onChange={(e) => setShowAdvancedStats(e.target.checked)}
          />
          <span>
            <strong>Advanced Rating Statistics</strong>
            <span className={profileStyles.advancedCheckHint}>
              Show OpenSkill μ (skill) and σ (uncertainty) in TEI tooltips and
              charts. Commission stays flavor over TEI — not a second ladder.{' '}
              <Link to="/tei">How TEI works →</Link>
            </span>
          </span>
        </label>
      </div>

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
            <TeiTable
              stats={stats}
              objective="go-out"
              showAdvanced={showAdvancedStats}
            />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Points TEI (reference AI)</legend>
            <TeiTable
              stats={stats}
              objective="points"
              showAdvanced={showAdvancedStats}
            />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Go-out TEI (human pool)</legend>
            <HumanTeiTable
              stats={stats}
              objective="go-out"
              showAdvanced={showAdvancedStats}
            />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Points TEI (human pool)</legend>
            <HumanTeiTable
              stats={stats}
              objective="points"
              showAdvanced={showAdvancedStats}
            />
          </fieldset>

          <fieldset className={styles.fieldset}>
            <legend>Squad Play (Module Zeta)</legend>
            <SquadTeiTable
              stats={stats}
              objective="go-out"
              showAdvanced={showAdvancedStats}
            />
            <SquadTeiTable
              stats={stats}
              objective="points"
              showAdvanced={showAdvancedStats}
            />
            <h3 className={profileStyles.sectionHeading}>Squad sector archive</h3>
            <SquadMatchHistory uid={auth.user.uid} />
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

          {/* Rating history charts */}
          <RatingHistoryChart
            history={history}
            objective="go-out"
            title="Go-out Rating History (μ over time)"
          />
          
          <RatingHistoryChart
            history={history}
            objective="points"
            title="Points Rating History (μ over time)"
          />

          <SigmaDecayChart
            history={history}
            objective="go-out"
            title="Go-out Confidence Convergence (σ decay)"
          />

          <SigmaDecayChart
            history={history}
            objective="points"
            title="Points Confidence Convergence (σ decay)"
          />

          <fieldset className={styles.fieldset}>
            <legend>Recent matches</legend>
            {history.length === 0 ? (
              <p className={styles.hint}>No matches recorded yet.</p>
            ) : (
              <ul className={profileStyles.historyList}>
                {history.map((entry) => {
                  // Use new OpenSkill rating if available, fallback to legacy TEI
                  const teiDisplay = entry.ratingAfter
                    ? getTeiDisplay(entry.ratingAfter, entry.ratingAfter.displayGrade).formatted
                    : entry.teiAfter != null
                    ? `TEI ${entry.teiAfter}`
                    : null;
                  
                  return (
                    <li key={entry.playedAt}>
                      {TEI_OBJECTIVE_LABEL[entry.objective]} vs{' '}
                      {formatMatchOpponentLabel(entry)}
                      {' — '}
                      {entry.won ? 'won' : 'lost'}
                      {entry.advisorUsed ? ' · advisor' : ''}
                      {teiDisplay ? ` · ${teiDisplay}` : ''}
                    </li>
                  );
                })}
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
