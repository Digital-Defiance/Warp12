import { Link } from 'react-router-dom';

import styles from './about-page.module.scss';

export function AboutPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Digital Defiance · nonprofit hobby project</p>
          <h1 className={styles.title}>About Warp 12</h1>
        </div>
        <Link to="/" className={styles.back}>
          Back to the bridge
        </Link>
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.lead}>
            <strong>Warp 12</strong> is a Star Trek–themed double-twelve domino game built
            on standard Mexican Train bones: Spacedock, warp trails, the Neutral Zone,
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
              Warp 12 is the best Mexican Train engine in the galaxy that is currently
              known.
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
            is the most complete <em>documented</em> Mexican Train engine available
            today: points and go-out objectives, house rules, optional modules, online
            sync, and TEI-rated play against fixed reference officers.
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
              href="https://leaderboard.warp12.app"
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
              <strong>Not rules-perfect.</strong> We follow published Mexican Train
              practice in <Link to="/rules">RULES.md</Link> and test heavily, but
              edge cases and house variants abound. Report bugs; do not assume infallibility.
            </li>
            <li>
              <strong>Not “strongest AI on Earth.”</strong> Class II officers are
              heuristic agents with calibrated tiers — not Deep Blue, not solved
              dominoes. Our experimental Class I* adds a neural residual on top;
              early results show it can mimic Commander but has not yet beaten
              Class II in go-out self-play.
            </li>
            <li>
              <strong>Not stronger than closed apps we cannot audit.</strong> We
              compare engines we can see. Black-box apps may play well; we simply
              cannot verify them.
            </li>
            <li>
              <strong>Not official Star Trek.</strong> Fan production; no Paramount /
              CBS affiliation.
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
                  <td>AI tiers (Class IV–II)</td>
                  <td>Self-play calibrated; human validation pending</td>
                </tr>
                <tr>
                  <td>Class I* (experimental)</td>
                  <td>Heuristic + neural residual; local opponent only; not TEI-rated</td>
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
          <h2 className={styles.sectionTitle}>Class I* — search without hiding the coach</h2>
          <p className={styles.p}>
            <strong>Class I*</strong> is our experimental “Deep Q” step for local
            play: the same Class II heuristics and explainable coach, but the AI
            opponent runs <strong>deep belief-state search</strong> before it commits
            to a move — expectimax in heads-up games, ISMCTS at three or more captains.
            Pick Class I* in a local game to face that deeper thinker. It stays labeled
            experimental because we are still measuring whether search beats Class II
            with statistical confidence — not just whether it feels different.
          </p>
          <p className={styles.p}>
            One design choice we keep: move <strong>explanations</strong> stay on the
            explainable heuristic stack — plain-language reasons you can read at the
            table. The optional advisor deep-think path can run ISMCTS on a short time
            budget; search chooses the line, heuristics describe why it makes sense.
          </p>
          <p className={styles.p}>
            <strong>What the numbers say so far (2026):</strong> a neural net (browser
            ONNX) learned to imitate Commander but stayed near <strong>50%</strong> win
            rate vs Class II in 2p — within noise. ISMCTS also flatlined at ~51% in 2p
            points (1,000 games). Fixed-depth expectimax did better (~64% vs Commander
            in 2p points). At four players go-out, ISMCTS outperformed greedy Commander
            seats (~31% vs ~23% sector wins). We route the right engine to each lobby
            setting. Results land in the{' '}
            <Link to="/paper/log">calibration log</Link> and{' '}
            <Link to="/paper">research outline</Link> — including negative results.
          </p>
          <p className={styles.p}>
            Class I* is <strong>not</strong> on the leaderboard TEI ladder yet. When — and
            only when — it beats Class II with statistical confidence, we will talk about
            promoting it toward a reference officer. Until then it is R&amp;D you can opt
            into at the local table. <strong>Class I</strong> on TEI remains the
            human prestige band — we do not reuse that name for AI until the bar is cleared.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>TEI — for captains and for us</h2>
          <p className={styles.p}>
            <strong>Tactical Effectiveness Index (TEI)</strong> is our Elo-style skill
            rating on the leaderboard. Two independent tracks —{' '}
            <strong>points</strong> and <strong>go-out</strong> — because they are
            strategically different games on the same table. Each track splits by the
            tactical class of AI you face (Class IV / III / II reference officers).
          </p>
          <p className={styles.p}>
            TEI is not just for captains. It is how <em>we</em> grow the fleet:
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Calibration feedback.</strong> Fixed reference bands (~TEI 1000 /
              1200 / 1400 points; wider for go-out) tell us whether Class IV–II AI
              ordering matches design intent.
            </li>
            <li>
              <strong>Honest variance.</strong> Go-out compresses skill gaps — we
              show percentiles as well as raw TEI so ranks stay meaningful.
            </li>
            <li>
              <strong>Advisor integrity.</strong> Matches where you used the tactical
              advisor still count in general stats, but <strong>TEI does not move</strong>{' '}
              — only unassisted wins are rated.
            </li>
            <li>
              <strong>Starfleet Academy.</strong> Pick a starting class and TEI band
              once per track before your first rated mission — go-out and points are
              independent.
            </li>
          </ul>
          <p className={styles.p}>
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
              <strong>Stronger officers.</strong> Class I* hybrid learning (in progress),
              ISMCTS-backed coach, maybe one day belief-state play — without sacrificing
              explainability for casual tables.
            </li>
            <li>
              <strong>Honest ML.</strong> Document when neural nets imitate without
              improving — go-out Class I* parity is a real result, not a failure to
              mention.
            </li>
            <li>
              <strong>Share the stack.</strong> Open packages so other builders can
              ship Mexican Train experiences on a engine you can read and test.
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
