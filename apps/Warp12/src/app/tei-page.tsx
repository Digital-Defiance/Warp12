import { Link } from 'react-router-dom';

import styles from './about-page.module.scss';

/**
 * Player-facing TEI primer plus an optional OpenSkill deep dive.
 * Keep RULES.md TEI-only; this page is where μ/σ live for curious captains.
 */
export function TeiPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Tactical Efficiency Index</p>
          <h1 className={styles.title}>How TEI works</h1>
        </div>
        <Link to="/profile" className={styles.back}>
          Back to profile
        </Link>
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.lead}>
            <strong>TEI</strong> is the rating you see on the HUD, profile, and
            leaderboard — a letter plus a score, like <strong>V67</strong>. You do
            not need OpenSkill, μ, or σ to play. Those only matter if you want the
            math underneath.
          </p>
          <p className={styles.p}>
            Rules of play and what counts as rated are in the{' '}
            <Link to="/rules">Navigational Operations Manual</Link> (Section VIII).
            This page explains the rating itself.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What you see</h2>
          <ul className={styles.list}>
            <li>
              <strong>Letter (E / V / C / I / P)</strong> — how established the
              rating is. Provisional → Improving → Consistent → Veteran → Elite as
              confidence tightens over rated play.
            </li>
            <li>
              <strong>Score (0–99)</strong> — conservative skill on one global
              scale. Same number ≈ same skill across letters: <strong>I40</strong>{' '}
              and <strong>C40</strong> are equally strong estimates; C is simply
              more settled.
            </li>
            <li>
              <strong>Federation commission</strong> — Cadet through Fleet Admiral —
              flavor ranks derived from your TEI path. Not a second ladder.
            </li>
            <li>
              <strong>Opponent tracks</strong> — Ensign / Lieutenant / Commander
              for Academy placement and rated AI buckets. Personal commission can
              climb higher (Flag Officer territory) through play.
            </li>
          </ul>
          <p className={styles.p}>
            Two independent objectives (points vs go-out), each split by opponent
            track. Beating Commander officers does not move your Ensign bucket.
            Only unassisted Warp 12 is rated.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>How the grade moves</h2>
          <p className={styles.p}>
            After a rated match the system updates both parts of the grade:
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Win against strong opposition</strong> → score tends to rise.
            </li>
            <li>
              <strong>Lose against weaker opposition</strong> → score tends to
              fall.
            </li>
            <li>
              <strong>Play more rated matches</strong> → confidence tends to
              tighten (letter climbs), and the conservative score often rises as
              the system becomes less cautious.
            </li>
          </ul>
          <p className={styles.p}>
            New modules can temporarily soften confidence (letter may drop, score
            may dip). That is re-evaluation under new conditions, not a penalty —
            more games in that setup bring it back.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>For the curious — OpenSkill</h2>
          <p className={styles.p}>
            Under the hood, each TEI track is an{' '}
            <a
              href="https://openskill.me/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenSkill
            </a>{' '}
            rating: a Bayesian skill model with two numbers per player (or per AI
            anchor). Warp maps those internals into the public TEI grade so
            captains see a stable federation readout instead of raw parameters.
          </p>
          <ul className={styles.list}>
            <li>
              <strong>μ (mu)</strong> — estimated skill. Higher is stronger.
            </li>
            <li>
              <strong>σ (sigma)</strong> — uncertainty. Starts high for new
              tracks; shrinks with consistent rated results; can widen again after
              long gaps or new rule mixes.
            </li>
            <li>
              <strong>Conservative skill</strong> — μ − 3σ, then normalized to the
              0–99 score. Using three sigmas keeps early ratings from looking more
              precise than they are.
            </li>
            <li>
              <strong>Letter from σ</strong> — approximate bands: E (σ &lt; 0.5), V
              (&lt; 1.5), C (&lt; 2.5), I (&lt; 4.0), P (≥ 4.0). Exact thresholds
              live in the engine / TEI spec.
            </li>
          </ul>
          <p className={styles.p}>
            Fixed AI officers (Ensign / Lieutenant / Commander) and online human
            pools update through the same model so solo and multiplayer stay on one
            scale.             Multi-captain tables, reference anchors, grade bands, and update
            rules are normative in{' '}
            <a
              href="https://github.com/Digital-Defiance/Warp12/blob/main/docs/tei-spec.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              docs/tei-spec.md
            </a>{' '}
            (v2 — OpenSkill).
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Advanced Rating Statistics</h2>
          <p className={styles.p}>
            On your <Link to="/profile">profile</Link>, turn on{' '}
            <strong>Advanced Rating Statistics</strong> to show μ and σ in TEI
            tooltips and related charts. Casual play leaves those hidden so the
            HUD stays letter + score (+ commission).
          </p>
          <div className={styles.links}>
            <Link to="/profile">Profile &amp; Advanced toggle</Link>
            <Link to="/modules">Modules · Promote vs Warped</Link>
            <Link to="/rules">Manual § VIII — Leaderboard / TEI</Link>
            <Link to="/research">Research paper (PDF)</Link>
            <Link to="/paper">Calibration log</Link>
            <a
              href="https://iwdf.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Public leaderboard
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
