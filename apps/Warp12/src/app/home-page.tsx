import { Link, useNavigate } from 'react-router-dom';

import { defaultCampaignRounds } from 'warp12-engine';

import { useLayoutTier } from './layout-tier-context';
import styles from './home-page.module.scss';
import { Warp12Logo } from './Warp12Logo';
import { FC } from 'react';
import { getWarpFactor } from './warp-factor';

export interface HomePageProps {
  factor?: number;
}

export const HomePage: FC<HomePageProps> = ({ factor }) => {
  const navigate = useNavigate();
  const layoutTier = useLayoutTier();
  const phoneLayout = layoutTier === 'phone';
  const warpFactor = getWarpFactor();
  const campaignRounds = warpFactor
    ? defaultCampaignRounds(warpFactor)
    : defaultCampaignRounds(12);
  const campaignCopy = warpFactor
    ? `a full points campaign across ${campaignRounds} spacedock rounds`
    : 'a full points campaign across the spacedock ladder';
  const teiCopy =
    warpFactor && warpFactor !== 12
      ? ' TEI ladders stay on Warp 12 — other factors are exhibition.'
      : '';
  const warpFactorSelection = (
    <section className={styles.warpFactorSelection}>
      <h2 className={styles.warpFactorSelectionHeading}>Choose your Warp Factor</h2>
      <Link to="/factor" className={styles.warpFactorSelectionLink}>
        <img
          src="/angle-right-vellum-solid-full.svg"
          alt=""
          aria-hidden="true"
          className={styles.warpFactorSelectionIcon}
          width={16}
          height={16}
        />
        {warpFactor ? 'Return' : 'Proceed'} to Warp Factor Selection
      </Link>
    </section>
  );
  
  const missionSection = (
    <section className={styles.mission}>
      <h2 className={styles.playHeading}>Choose your mission</h2>
      <div className={styles.grid}>
        <button
          type="button"
          className={styles.card}
          onClick={() => navigate('/local')}
        >
          <h2>Local simulation</h2>
          <p>Play against AI captains — first out or points campaign.</p>
        </button>
        <button
          type="button"
          className={styles.card}
          onClick={() => navigate('/local/pass-and-play')}
        >
          <h2>Pass and play</h2>
          <p>Humans on one device — share the bridge, unrated local table.</p>
        </button>
        <button
          type="button"
          className={styles.card}
          onClick={() => navigate('/online')}
        >
          <h2>Online fleet</h2>
          <p>Create or join a sector</p>
        </button>
      </div>
    </section>
  );

  const doubleMap = {
    9: 'Double-nine',
    12: 'Double-twelve',
    15: 'Double-fifteen',
    18: 'Double-eighteen',
  }
  const heroSection = phoneLayout ? (
    <details className={styles.fold}>
      <summary className={styles.foldSummary}>About Warp</summary>
      <div className={styles.foldBody}>
        <p className={styles.heroEyebrow}>{doubleMap[warpFactor as keyof typeof doubleMap]} dominoes · fleet tactics</p>
        <p className={styles.heroLead}>
          <strong>Warp</strong> is competitive, <span className={styles.tooltip} data-tooltip="Multi-trail Interstellar Dominoes">multi-trail interstellar dominoes</span> with
          fleet decorum: <em><span className={styles.tooltip} data-tooltip="Tiles">navigational coordinates</span></em>, <em><span className={styles.tooltip} data-tooltip="Hub/Engine">Spacedock</span></em>, and{' '}
          <em><span className={styles.tooltip} data-tooltip="Trains">warp trails</span></em> into the <span className={styles.tooltip} data-tooltip="Community / public train">Neutral Zone</span>.
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
          <Link to="/modules" className={styles.heroLink}>
            Modules
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
      <p className={styles.heroEyebrow}>{doubleMap[warpFactor as keyof typeof doubleMap]} dominoes · fleet tactics</p>
      <h1 className={styles.heroTitle}>
        Chart the sector. Empty your hand. Win the campaign.
      </h1>
      <p className={styles.heroLead}>
          <strong>Warp</strong> is competitive, <span className={styles.tooltip} data-tooltip="Multi-trail Interstellar Dominoes">multi-trail interstellar dominoes</span> with
          fleet decorum: <em><span className={styles.tooltip} data-tooltip="Tiles">navigational coordinates</span></em>, <em><span className={styles.tooltip} data-tooltip="Hub/Engine">Spacedock</span></em>, and{' '}
          <em><span className={styles.tooltip} data-tooltip="Trains">warp trails</span></em> into the <span className={styles.tooltip} data-tooltip="Community / public train">Neutral Zone</span>.      </p>
      <p className={styles.heroLead}>
        Warp is what the night shift plays on the bridge.
      </p>
      <p className={styles.heroBody}>
        Match pips to chart routes on your trail, the communal Neutral Zone, or a
        rival&apos;s line when their distress beacon is down. Doubles trigger red
        alert. Optional house rules add Drop to Impulse; optional modules add
        subspace fractures, All Stop! drama, and Q-Continuum chaos. Play a quick
        first-out sprint or {campaignCopy}.{teiCopy}
      </p>
      <p className={styles.heroLinks}>
        <Link to="/about" className={styles.heroLink}>
          About Warp — engine, TEI, and what we claim
        </Link>
        {' · '}
        <Link to="/modules" className={styles.heroLink}>
          Modules — play-tested, Promote vs Warped
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
          Warp is a fan-made hobby project from a nonprofit, one-person dev
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
        Warp has no referees — it runs on the honor of the captains at the
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
      <li><img className={styles.platformIcon} height="16" src="/microsoft-brands-solid-full.svg" alt="Microsoft Store" /> <a className={styles.platformLink} target="_blank" rel="noopener noreferrer" href="https://apps.microsoft.com/detail/9MX863SLRZWM">Microsoft Store</a></li>
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
        <Link to="/modules" className={styles.footerLink}>
          Modules
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
      <div className={styles.logoContainer}>
        <Warp12Logo
          width={400}
          factor={factor}
        />
      </div>
      {phoneLayout ? (
        <>
          <p className={styles.phoneTagline}>
            Chart the sector. Empty your hand. Win the campaign.
          </p>
          {warpFactorSelection}
          {warpFactor ? missionSection : undefined}
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
          {warpFactorSelection}
          {warpFactor ? missionSection : undefined}
          {appsSection}
        </>
      )}
      {footerSection}
    </div>
  );
}
