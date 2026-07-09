import { Link, useNavigate } from 'react-router-dom';

import { useLayoutTier } from './layout-tier-context';
import styles from './home-page.module.scss';

export function HomePage() {
  const navigate = useNavigate();
  const layoutTier = useLayoutTier();
  const phoneLayout = layoutTier === 'phone';

  const missionSection = (
    <section className={styles.mission}>
      <h2 className={styles.playHeading}>Choose your mission</h2>
      {phoneLayout ? (
        <p className={styles.playRequirement}>
          Phone preview — round summaries work best in portrait.
        </p>
      ) : (
        <p className={styles.playRequirement}>
          Tablet or desktop recommended. Phone layout preview — portrait for
          round summaries.
        </p>
      )}
      <div className={styles.grid}>
        <button
          type="button"
          className={styles.card}
          onClick={() => navigate('/local')}
        >
          <h2>Local simulation</h2>
          <p>Play against 2–7 AI captains — first out or points campaign.</p>
        </button>
        <button
          type="button"
          className={styles.card}
          onClick={() => navigate('/local/pass-and-play')}
        >
          <h2>Pass and play</h2>
          <p>2–8 humans on one device — share the bridge, unrated local table.</p>
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
  );

  const heroSection = phoneLayout ? (
    <details className={styles.fold}>
      <summary className={styles.foldSummary}>About Warp 12</summary>
      <div className={styles.foldBody}>
        <p className={styles.heroEyebrow}>Double-twelve dominoes · fleet tactics</p>
        <p className={styles.heroLead}>
          <strong>Warp 12</strong> is tournament Mexican Train in federation
          dress: <em>navigational coordinates</em>, <em>Spacedock</em>, and{' '}
          <em>warp trails</em> into the Neutral Zone.
        </p>
        <p className={styles.heroBody}>
          Doubles trigger red alert. Optional modules add subspace fractures,
          All Stop!, and Continuum chaos. Points campaign or first-out sprint.
        </p>
        <p className={styles.heroLinks}>
          <Link to="/about" className={styles.heroLink}>
            About &amp; TEI
          </Link>
          {' · '}
          <Link to="/rules" className={styles.heroLink}>
            Operations Manual
          </Link>
        </p>
      </div>
    </details>
  ) : (
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
      <p className={styles.heroLead}>
        Warp 12 is what Wesley would play if he were playing Mexican Train on the
        Enterprise.
      </p>
      <p className={styles.heroBody}>
        Match pips to chart routes on your trail, the communal Neutral Zone, or a
        rival&apos;s line when their distress beacon is down. Doubles trigger red
        alert. Optional house rules add Drop to Impulse; optional modules add
        subspace fractures, All Stop! drama, and Q-Continuum chaos. Play a quick
        first-out sprint or a full points campaign across thirteen spacedock
        rounds.
      </p>
      <p className={styles.heroLinks}>
        <Link to="/about" className={styles.heroLink}>
          About Warp 12 — engine, TEI, and what we claim
        </Link>
        {' · '}
        <Link to="/rules" className={styles.heroLink}>
          Read the Navigational Operations Manual
        </Link>
      </p>
    </section>
  );

  const disclaimerSection = phoneLayout ? (
    <details className={styles.fold}>
      <summary className={styles.foldSummary}>Before you launch</summary>
      <div className={styles.foldBody}>
        <ul className={styles.disclaimerList}>
          <li>
            Fan-made hobby project — built for fun with friends, not sanctioned
            tournament play.
          </li>
          <li>
            House-variant rules; may differ from your table&apos;s customs.
          </li>
          <li>
            Young implementation — trust living-room adjudication over the app
            when something looks wrong.
          </li>
          <li>
            Best on tablet/desktop; phone bridge layout is in preview.
          </li>
        </ul>
      </div>
    </details>
  ) : (
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
        <li>
          Warp 12 is built for <strong>tablets and desktops</strong>. A{' '}
          <strong>phone layout</strong> is in preview — rotate to portrait for
          round summaries.
        </li>
      </ul>
    </section>
  );

  const oathSection = phoneLayout ? (
    <details className={styles.fold}>
      <summary className={styles.foldSummary}>The Captain&apos;s Oath</summary>
      <div className={styles.foldBody}>
        <p className={styles.oathBody}>
          Rated play is a matter of record — play with honor, run the sanctioned
          build, and keep the TEI pool clean.
        </p>
        <Link to="/rules" className={styles.heroLink}>
          Full oath in the Manual
        </Link>
      </div>
    </details>
  ) : (
    <section className={styles.disclaimer} aria-label="The Captain's Oath">
      <h2 className={styles.disclaimerTitle}>The Captain&apos;s Oath</h2>
      <p className={styles.oathBody}>
        Warp 12 has no referees — it runs on the honor of the captains at the
        table. Rated play is a matter of record, so we hold a simple line: play
        with honor, run the sanctioned build, earn your rating, and keep the
        pool clean. We don&apos;t cheat, tamper with the client, farm or sandbag
        TEI — and if we see cheating, we report it. It&apos;s the code any
        officer worth the uniform lives by.
      </p>
      <Link to="/rules" className={styles.heroLink}>
        Read the full oath in the Operations Manual
      </Link>
    </section>
  );

  const appsSection = (<section>
    <h4>Available on multiple platforms</h4>
    <ul>
      <li><img className={styles.platformIcon} height="16" src="/google-play-brands-solid-full.svg" alt="Google Play" /> <a className={styles.platformLink} target="_blank" rel="noopener noreferrer" href="https://play.google.com/store/apps/details?id=org.digitaldefiance.app.warp12">Google Play</a></li>
      <li><img className={styles.platformIcon} height="16" src="/beer-mug-duotone-solid-full.svg" alt="Homebrew" /> <a className={styles.platformLink} target="_blank" rel="noopener noreferrer" href="https://brew.digitaldefiance.org">Mac via Homebrew</a></li>
    </ul>
    <p>More pending app store review!</p>
  </section>);

  const footerSection = (
    <section className={styles.footer}>
      <div>© 2026 Digital Defiance</div>
      <div>
        &lt;{' '}
        <a
          className={styles.footerLink}
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/Digital-Defiance/Warp12"
        >
          GitHub
        </a>
        &nbsp;|&nbsp;
        <Link to="/about" className={styles.footerLink}>
          About
        </Link>
        &nbsp;|&nbsp;
        <Link to="/privacy" className={styles.footerLink}>
          Privacy Policy
        </Link>
        &nbsp;|&nbsp;
        <a
          className={styles.footerLink}
          target="_blank"
          rel="noopener noreferrer"
          href="https://github.com/Digital-Defiance/Warp12/blob/main/LICENSE"
        >
          MIT License
        </a>{' '}
        &gt;
      </div>
    </section>
  );

  return (
    <div className={styles.page} data-layout-tier={layoutTier}>
      <img src="/Warp12-feat-tx.png" alt="" className={styles.heroImage} />
      {phoneLayout ? (
        <>
          <p className={styles.phoneTagline}>
            Chart the sector. Empty your hand. Win the campaign.
          </p>
          {missionSection}
          {heroSection}
          {disclaimerSection}
          {oathSection}
          {appsSection}
        </>
      ) : (
        <>
          {heroSection}
          {disclaimerSection}
          {oathSection}
          {missionSection}
          {appsSection}
        </>
      )}
      {footerSection}
    </div>
  );
}
