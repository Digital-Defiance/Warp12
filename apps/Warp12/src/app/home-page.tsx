import { Link, useNavigate } from 'react-router-dom';

import styles from './home-page.module.scss';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.heroEyebrow}>Double-twelve dominoes · fleet tactics</p>
        <h1 className={styles.heroTitle}>
          Chart the sector. Empty your hand. Win the campaign.
        </h1>
        <p className={styles.heroLead}>
          <strong>Warp 12</strong> is a double-twelve domino variant dressed in
          starship ops jargon: tiles are <em>navigational coordinates</em>, the
          center double is <em>Spacedock</em>, and every captain builds a{' '}
          <em>warp trail</em> into the void.
        </p>
        <p className={styles.heroBody}>
          Match pips to chart routes on your trail, the communal Neutral Zone, or
          a rival&apos;s line when their distress beacon is down. Doubles trigger
          red alert. Optional modules add subspace fractures, treaty drama, and
          Q-Continuum chaos. Play a quick first-out sprint or a full penalty
          campaign across thirteen spacedock rounds.
        </p>
        <Link to="/rules" className={styles.heroLink}>
          Read the Navigational Operations Manual
        </Link>
      </section>

      <section className={styles.disclaimer} aria-label="Disclaimer">
        <h2 className={styles.disclaimerTitle}>Before you launch</h2>
        <ul className={styles.disclaimerList}>
          <li>
            Warp 12 is a fan-made hobby project from a nonprofit, one-person dev
            team — built for fun with friends, not sanctioned tournament play.
          </li>
          <li>
            These rules are our best interpretation of a house variant; they may
            differ from your table&apos;s customs and are not official domino
            tournament standards.
          </li>
          <li>
            The digital implementation is young. Expect rough edges, rule
            mismatches, and logic bugs. If something looks wrong, trust your
            living-room adjudication over the app.
          </li>
        </ul>
      </section>

      <section>
        <h2 className={styles.playHeading}>Choose your mission</h2>
        <div className={styles.grid}>
          <button
            type="button"
            className={styles.card}
            onClick={() => navigate('/local')}
          >
            <h2>Local simulation</h2>
            <p>Play against 2–7 AI captains — first out or penalty campaign.</p>
          </button>
          <button
            type="button"
            className={styles.card}
            onClick={() => navigate('/online')}
          >
            <h2>Online fleet</h2>
            <p>Create or join a sector — syncs via Firebase warp-12.</p>
          </button>
        </div>
      </section>
      <section>
        <div>© 2026 Digital Defiance, Jessica Mulein.</div>
        <div>Source code available on <a className="no-underline" target="_blank" rel="noopener noreferrer" href="https://github.com/Digital-Defiance/Warp12">GitHub</a>.</div>
        <div><a className="no-underline" target="_blank" rel="noopener noreferrer" href="https://github.com/Digital-Defiance/Warp12/blob/main/LICENSE">MIT License</a></div>
      </section>
    </div>
  );
}
