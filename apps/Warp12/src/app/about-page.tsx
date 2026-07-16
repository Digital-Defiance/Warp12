import { Link } from 'react-router-dom';

import { formatAppVersionLabel } from './app-version';
import styles from './about-page.module.scss';

export function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Digital Defiance · nonprofit hobby project</p>
          <h1 className={styles.title}>About Warp 12</h1>
          <p className={styles.version} aria-label={`App version ${formatAppVersionLabel()}`}>
            {formatAppVersionLabel()}
          </p>
        </div>
        <Link to="/" className={styles.back}>
          Back to the bridge
        </Link>
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.lead}>
            <strong>Warp 12</strong> is federation–themed multi-trail{' '}
            <em>Interstellar Dominoes</em>: Spacedock, warp trails, the Neutral Zone,
            distress beacons, doubles and red alert, and optional house rules. Under the
            chrome is a deterministic rules engine, calibrated AI officers, and a
            tactical coach — all running the same code path.
          </p>
          <p className={styles.p}>
            We built it for friends, fleet nights, and the joy of a good table — not
            as an official tournament adjudicator. The app is young. The engine is
            ambitious. We are honest about both.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What we claim</h2>
          <div className={styles.calloutClaim}>
            <strong>
              Warp 12 is the best Interstellar Dominoes engine in the galaxy that is
              currently known.
            </strong>
          </div>
          <p className={styles.p}>
            That sentence is deliberate. <strong>Engine</strong> means the rules
            simulation and AI core — not “best app,” “most downloads,” or “official
            tournament standard.” <strong>Currently known</strong> means among
            implementations we can actually inspect: a published spec (
            <Link to="/rules">Navigational Operations Manual</Link>), open packages (
            <code>warp12-engine</code>, <code>warp12-react</code>), automated tests, and
            self-play calibration reports.
          </p>
          <p className={styles.p}>
            Most store apps are well loved but closed boxes — three difficulty sliders,
            no public rules engine, no reproducible AI validation. We believe Warp 12
            is the most complete <em>documented</em> multi-trail Interstellar Dominoes
            engine available today: points and go-out objectives, house rules, optional
            modules, online sync, and TEI-rated play against fixed reference officers.
          </p>
          <div className={styles.links}>
            <Link to="/paper">Research &amp; calibration log</Link>
            <a
              href="https://github.com/Digital-Defiance/Warp12/blob/main/docs/mexican-train-engine-comparison.md"
              target="_blank"
              rel="noopener noreferrer"
            >
              Engine survey (GitHub)
            </a>
            <a
              href="https://iwdf.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Leaderboard
            </a>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What we do not claim</h2>
          <div className={styles.calloutWarn}>
            <strong>
              Do not use Warp 12 to settle sanctioned tournament disputes — yet.
            </strong>{' '}
            Our engine is unproven for competitive adjudication until external
            benchmarks and human validation say otherwise.
          </div>
          <ul className={styles.list}>
            <li>
              <strong>Not tournament-certified.</strong> We are a fan-made hobby
              project. Trust your living-room referee over the app when customs
              differ.
            </li>
            <li>
              <strong>Not rules-perfect.</strong> We follow published multi-trail
              practice in <Link to="/rules">RULES.md</Link> and test heavily, but
              edge cases and house variants abound. Report bugs; do not assume infallibility.
            </li>
            <li>
              <strong>Not “strongest AI on Earth.”</strong> Commander officers run a
              calibrated neural policy (Ω) — strong tournament-style play, not
              solved dominoes. Optional <strong>extended thinking</strong> (Ω+)
              adds search for exhibition matches. Experimental Class I* remains
              a separate local research tier.
            </li>
            <li>
              <strong>Not stronger than closed apps we cannot audit.</strong> We
              compare engines we can see. Black-box apps may play well; we simply
              cannot verify them.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The engine (honest status)</h2>
          <p className={styles.p}>
            The Warp engine drives every chart, draw, beacon, fracture, and score —
            for humans, AI captains, and the tactical advisor. That unity is a
            feature: the coach cannot cheat because it uses the same legal-move
            generator as everyone else.
          </p>
          <p className={styles.p}>
            <strong>Status: unproven for tournament use, actively validated for play.</strong>{' '}
            We run self-play calibration (
            <code>yarn calibrate:ai-tei</code>), maintain 200+ engine tests, and
            publish methodology. Planned next steps: a conformance scenario suite
            (MT-Compliance) and external human studies. Until then, treat TEI and AI
            tiers as <em>our best honest ladder</em>, not a certified rating authority.
          </p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Layer</th>
                  <th>Today</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Rules fidelity</td>
                  <td>Spec + tests; not externally benchmarked</td>
                </tr>
                <tr>
                  <td>AI tiers (Ensign–Commander)</td>
                  <td>
                    Ensign–Lieutenant heuristics; Commander = neural Ω (greedy).
                    TEI anchors recalibrated in v2 (1520 pts / 1550 go-out).
                  </td>
                </tr>
                <tr>
                  <td>Extended thinking (Ω+)</td>
                  <td>
                    Optional on Commander in local play — search-backed, unrated
                    exhibition
                  </td>
                </tr>
                <tr>
                  <td>Class I* (experimental)</td>
                  <td>Heuristic + search/residual research tier; not TEI-rated</td>
                </tr>
                <tr>
                  <td>Go-out vs points</td>
                  <td>Separate profiles and TEI tracks — same engine</td>
                </tr>
                <tr>
                  <td>Tournament readiness</td>
                  <td>Explicitly not ready</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Commander — neural officers (Ω)</h2>
          <p className={styles.p}>
            <strong>Commander</strong> is the rated strong AI tier. Under the hood it
            runs <strong>Ω</strong> — a self-play neural policy trained on the real
            engine (Distress Beacons, Red Alert, modules, both objectives). Players
            still see “Commander” / “Cmdr.” in the lobby; there is no separate “pick Omega”
            switch for rated play.
          </p>
          <p className={styles.p}>
            <strong>Extended thinking (Ω+)</strong> is optional in local simulation:
            same weights, but the officer runs net-guided search before committing.
            It is labeled <strong>unrated exhibition</strong> — harder practice, not
            a second ladder tier.
          </p>
          <p className={styles.p}>
            The <strong>tactical advisor</strong> now follows Ω’s greedy pick and
            explains it in plain language (heuristic reasons you can read at the
            table). Advisor use still disqualifies a match from TEI — only
            unassisted play is rated.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Class I* — research tier</h2>
          <p className={styles.p}>
            <strong>Class I*</strong> is our experimental search/residual track for
            local play: expectimax or ISMCTS on top of heuristics, plus optional
            learned residuals. It is <strong>not</strong> the same as Commander Ω and
            is <strong>not</strong> on the TEI ladder. Early benches showed imitation
            nets near 50% vs legacy Commander — useful R&amp;D, not a promotion
            candidate yet.
          </p>
          <p className={styles.p}>
            Results land in the{' '}
            <Link to="/paper/log">calibration log</Link> and{' '}
            <Link to="/paper">research outline</Link> — including negative results.
            <strong>Flag Officer</strong> on TEI remains the human prestige band.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TEI — for captains and for us</h2>
          <p className={styles.p}>
            <strong>Tactical Efficiency Index (TEI)</strong> is the leaderboard rating —
            a letter + score (like <strong>V67</strong>) plus a derived federation
            commission. Two independent tracks — <strong>points</strong> and{' '}
            <strong>go-out</strong> — because they are strategically different games on
            the same table. Each track splits by the AI commission track you face
            (Ensign / Lieutenant / Commander). Only <strong>Warp 12</strong>{' '}
            (double-twelve) is rated; Warp 9 / 15 / 18 are exhibition and never move
            TEI.
          </p>
          <p className={styles.p}>
            TEI is not just for captains. It is how <em>we</em> grow the fleet:
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Calibration feedback.</strong> Fixed reference anchors tell us
              whether Ensign–Commander ordering matches design intent, tracking both
              skill and confidence.
            </li>
            <li>
              <strong>Honest variance.</strong> Go-out compresses skill gaps — we
              show TEI grades and percentiles so ranks stay meaningful.
            </li>
            <li>
              <strong>Advisor integrity.</strong> Matches where you used the tactical
              advisor still count in general stats, but <strong>TEI does not move</strong>{' '}
              — only unassisted wins are rated.
            </li>
            <li>
              <strong>Federation Academy.</strong> Pick a starting commission track and TEI band
              once per track before your first rated mission — go-out and points are
              independent.
            </li>
          </ul>
          <p className={styles.p}>
            Want the OpenSkill μ/σ story? See <Link to="/tei">How TEI works</Link>.
            For modules, Promote vs Warped, and why Squadrons rebuilt the ladder, see{' '}
            <Link to="/modules">Modules</Link>.
            When captains climb the board, we learn whether our officers and engine
            still feel fair. When calibration drifts, we retune — that loop is the
            point. See the living{' '}
            <Link to="/paper/log">calibration log</Link> and{' '}
            <Link to="/paper">research outline</Link> for what we measured and what
            we changed.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What we aspire to</h2>
          <ul className={styles.list}>
            <li>
              <strong>Prove the engine.</strong> Published conformance scenarios,
              MT-Bench seeds, and optional human studies — so “best known engine”
              becomes an evidence-backed statement, not marketing alone.
            </li>
            <li>
              <strong>Earn tournament trust.</strong> Only after external validation
              would we invite serious competitive use — today we explicitly discourage
              it.
            </li>
            <li>
              <strong>Stronger officers.</strong> Commander ships as neural Ω; Ω+
              extended thinking for exhibition; Class I* research continues on the
              side — without sacrificing explainability for casual tables.
            </li>
            <li>
              <strong>Honest ML.</strong> Document when neural nets imitate without
              improving — go-out Class I* parity is a real result, not a failure to
              mention.
            </li>
            <li>
              <strong>Share the stack.</strong> Open packages so other builders can
              ship Interstellar Dominoes experiences on an engine you can read and test.
            </li>
            <li>
              <strong>Write it up.</strong> A short paper on dual-objective
              calibration, go-out vs points variance, and what “skill” means in
              imperfect-information dominoes.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Who builds this</h2>
          <p className={styles.p}>
            Warp 12 is a free, nonprofit hobby project by{' '}
            <strong>Digital Defiance</strong>,
            friends at the table, MIT-licensed code on{' '}
            <a
              href="https://github.com/Digital-Defiance/Warp12"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
            . Feedback and bug reports make the engine better for everyone.
          </p>
        </section>
      </div>
    </div>
  );
}
