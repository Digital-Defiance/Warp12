import { useState } from 'react';
import { Link } from 'react-router-dom';

import {
  MODULE_CATALOG,
  MODULE_STUDY_META,
  formatMix,
  formatSkill,
  labelFor,
  metricsFor,
  studyMetaFor,
  taxonomyLabel,
  type ModuleStatRow,
  type ModuleStudyInstrument,
} from '../content/module-catalog.js';

import styles from './about-page.module.scss';
import moduleStyles from './modules-page.module.scss';

export function ModulesPage() {
  const [instrument, setInstrument] =
    useState<ModuleStudyInstrument>('points');
  const study = studyMetaFor(instrument);
  const other =
    instrument === 'points'
      ? MODULE_STUDY_META.goOut
      : MODULE_STUDY_META.points;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Optional systems · competitive integrity</p>
          <h1 className={styles.title}>Modules</h1>
        </div>
        <Link to="/rules" className={styles.back}>
          Full Manual § VI
        </Link>
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <p className={styles.lead}>
            Warp ships core multi-trail Interstellar Dominoes (Manual Sections
            I–V) plus optional <strong>modules</strong> — Alpha through Lambda,
            Subspace Fracture, and the Official Warp preset. Each module is a
            deliberate rules experiment. Most preserve skill. A few are{' '}
            <strong>Warped</strong>: party chaos or intentional inversion that
            never touches TEI.
          </p>
          <p className={styles.p}>
            This page is the captain’s digest: what each module does, how we{' '}
            <em>measured</em> it, and why Epsilon is a party module while Zeta is
            crew-night fuel <em>and</em> serious team competition — serious enough
            that we rebuilt the rating stack for it.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Play-tested at machine scale</h2>
          <div className={styles.calloutClaim}>
            <strong>
              {(
                MODULE_STUDY_META.points.totalGames +
                MODULE_STUDY_META.goOut.totalGames
              ).toLocaleString()}{' '}
              Commander self-play games
            </strong>{' '}
            across two instruments —{' '}
            {MODULE_STUDY_META.points.totalGames.toLocaleString()} points (
            {MODULE_STUDY_META.points.totalConfigs} cells) and{' '}
            {MODULE_STUDY_META.goOut.totalGames.toLocaleString()} go-out (
            {MODULE_STUDY_META.goOut.totalConfigs} cells),{' '}
            {MODULE_STUDY_META.gamesPerCell} games each — Warp factors 9 / 12 /
            15 / 18 × every legal fleet size × module setups (Epsilon omitted
            under go-out; Zeta only on eligible even fleets).
          </div>
          <p className={styles.p}>
            Dominoes apps usually ship module toggles on vibes: “drafting sounds
            skillful,” “teams sound casual.” We instrumented mid-game{' '}
            <em>decision quality</em> instead — legal moves, forced tiles,
            how far best and worst moves diverge, pip diversity in hand — and
            ranked every module on a 0–4 skill-indicator scale.
          </p>
          <p className={styles.p}>
            We may be the only people who have ever stress-tested multi-trail
            Interstellar Dominoes modules this way: full engine self-play,
            identical AI seats, published metrics, and a public Promote vs Warped
            taxonomy grounded in data rather than marketing copy. The research
            write-up lives in the{' '}
            <Link to="/research">TEI paper</Link> (§9 points · go-out section)
            and <Link to="/paper/log">calibration log</Link>.
          </p>
          <p className={styles.p}>{MODULE_STUDY_META.method}</p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skill ceiling at a glance</h2>
          <p className={styles.p}>
            Higher average skill indicators mean mid-game choices still
            discriminate strong play. Skill / mixed / luck counts are how many
            Warp×fleet cells fell in each band. Points and go-out are{' '}
            <strong>separate instruments</strong> — forked modules (Beta, Delta,
            Eta, Theta, Kappa) change mid-game pressure, so do not compare means
            across the toggle as one ranking.
          </p>

          <div
            className={moduleStyles.instrumentTabs}
            role="tablist"
            aria-label="Skill study instrument"
          >
            <button
              type="button"
              role="tab"
              id="modules-instrument-points"
              aria-controls="modules-skill-table"
              aria-selected={instrument === 'points'}
              className={`${moduleStyles.instrumentTab} ${
                instrument === 'points' ? moduleStyles.instrumentTabActive : ''
              }`}
              onClick={() => setInstrument('points')}
            >
              Points campaign
            </button>
            <button
              type="button"
              role="tab"
              id="modules-instrument-go-out"
              aria-controls="modules-skill-table"
              aria-selected={instrument === 'go-out'}
              className={`${moduleStyles.instrumentTab} ${
                instrument === 'go-out' ? moduleStyles.instrumentTabActive : ''
              }`}
              onClick={() => setInstrument('go-out')}
            >
              Go-out
            </button>
          </div>

          <p className={moduleStyles.instrumentMeta} id="modules-skill-table-desc">
            Showing{' '}
            <strong>
              {instrument === 'points' ? 'points' : 'go-out'}
            </strong>
            : {study.totalGames.toLocaleString()} games · {study.totalConfigs}{' '}
            cells ({study.generated}). Companion instrument:{' '}
            {other.totalGames.toLocaleString()} games / {other.totalConfigs}{' '}
            cells.
          </p>

          <div className={styles.tableWrap}>
            <table
              className={styles.table}
              id="modules-skill-table"
              role="tabpanel"
              aria-labelledby={
                instrument === 'points'
                  ? 'modules-instrument-points'
                  : 'modules-instrument-go-out'
              }
              aria-describedby="modules-skill-table-desc"
            >
              <thead>
                <tr>
                  <th scope="col">Module</th>
                  <th scope="col">Taxonomy</th>
                  <th scope="col">Skill</th>
                  <th scope="col">S/M/L</th>
                </tr>
              </thead>
              <tbody>
                {MODULE_CATALOG.map((row) => {
                  const metrics = metricsFor(row, instrument);
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className={moduleStyles.greek}>{row.greek}</span>{' '}
                        {labelFor(row, instrument)}
                      </td>
                      <td>
                        <span
                          className={`${moduleStyles.badge} ${badgeClass(row)}`}
                        >
                          {taxonomyLabel(row.taxonomy)}
                        </span>
                      </td>
                      <td>
                        {metrics ? (
                          formatSkill(metrics)
                        ) : (
                          <span className={moduleStyles.na}>
                            — unavailable
                          </span>
                        )}
                      </td>
                      <td>
                        {metrics ? (
                          formatMix(metrics)
                        ) : (
                          <span className={moduleStyles.na}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={styles.p}>
            Full rules text for every toggle:{' '}
            <Link to="/rules">Navigational Operations Manual § VI</Link>.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Epsilon — why drafting is a party module
          </h2>
          <div className={styles.calloutWarn}>
            <strong>Warped / party · never rated.</strong> Points instrument:{' '}
            average skill indicators <strong>1.08/4</strong> — luck-dominant in
            27 of 38 cells. Zero skill-dominant configurations. Unavailable under
            go-out (RULES §VI).
          </div>
          <p className={styles.p}>
            <strong>Module Epsilon — Tactical Requisition</strong> replaces the
            blind deal with pack-and-pass drafting. Captains pick into loadouts,
            pass residual packs, and launch. Intuition says: choosing your hand
            must raise skill. The points table disagrees.
          </p>
          <ul className={styles.list}>
            <li>
              Legal moves shrink (~1.3 vs ~2.1 baseline) — fewer discriminating
              forks mid-game.
            </li>
            <li>
              Constrained tiles drop (36% vs 57%) — fewer forced coordinates to
              navigational skill.
            </li>
            <li>
              Move-value spreads and unique pips compress — coherent drafted
              hands leave less room to recover with elegant play later.
            </li>
          </ul>
          <p className={styles.p}>
            Outcomes lean toward who drafted the lucky connectors. That makes
            Epsilon <em>excellent</em> as the entertainment: the requisition
            ritual <em>is</em> the game night. It is a poor competitive module
            and is barred from TEI (Manual marks it Warped / exhibition).
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Zeta — crew nights and serious squads
          </h2>
          <div className={styles.calloutClaim}>
            <strong>Skill-promote · Squad TEI on rated Warp 12.</strong> About{' '}
            <strong>2.94/4</strong> skill indicators on both instruments
            (17 eligible-fleet cells) — shared trails keep pressure high. Not
            Warped; never writes FFA human TEI.
          </div>
          <p className={styles.p}>
            <strong>Module Zeta — Fleet Squadrons</strong> divides the fleet
            into equal crews: one shared Warp Trail and Distress Beacon per
            squadron, bridge seating that alternates teams, open teammate
            table-talk, and squad-aggregate scoring. It is how Warp 15 / 18
            fleets stay legible — and how living-room nights feel like a crew
            on the same mission. Hosts assign crews in the online lobby
            (names + drag roster); local / pass-and-play stay FFA-only.
          </p>
          <p className={styles.p}>
            Zeta is <strong>party-capable</strong> in the social sense: laughing
            over a shared beacon, arguing over the Neutral Zone, celebrating a
            squad go-out. It is also <strong>competitively serious</strong>. The
            skill instrument does not collapse — which is why rated Warp 12
            sectors update <strong>Squad TEI</strong> on your profile (OpenSkill
            team track), never the FFA human ladder.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Why we tore out Elo for OpenSkill — then built TEI
          </h2>
          <p className={styles.p}>
            Warp originally shipped a carefully tuned Elo ladder: integer TEI
            bands, K-factor schedules, clean heads-up math. Elo is great for
            two humans trading wins. It is awkward the moment you need{' '}
            <em>teams of captains</em>, mixed human/AI tables, and Bayesian
            confidence that withstands noisy go-out races.
          </p>
          <p className={styles.p}>
            <strong>Module Zeta forced the issue.</strong> Squadrons are
            first-class OpenSkill citizens — whole crews rated together, with
            per-seat credit inside the team — the same family of models that
            power TrueSkill-style multiplayer. Keeping a bolted-on Elo team
            hack would have lied about uncertainty and broken the Zeta promise.
            So we replaced the Elo core with{' '}
            <a
              href="https://openskill.me/"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenSkill
            </a>{' '}
            (μ ± σ), fixed AI anchors, and FFA / team / vs-AI update paths.
          </p>
          <p className={styles.p}>
            Raw Gaussians are honest; they are not what you want next to a
            captain name on the HUD. <strong>TEI</strong> is the presentation
            layer we built so OpenSkill feels federation-tangible: letter grades
            from confidence (E / V / C / I / P), a 0–99 conservative score, and
            commission ranks from Cadet to Fleet Admiral. Military-readable.
            Still Bayesian underneath.
          </p>
          <div className={styles.links}>
            <Link to="/tei">How TEI works</Link>
            <Link to="/research">Research paper (PDF)</Link>
            <Link to="/about">About Warp 12</Link>
            <Link to="/rules">Manual § VI Modules · § VIII TEI</Link>
          </div>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Module field guide</h2>
          <p className={styles.p}>
            How each module changes the table. Exact scoring footnotes and edge
            cases remain in the Manual — this is the operating briefing. Telemetry
            line below each entry follows the instrument toggle above.
          </p>
          <ul className={moduleStyles.guide}>
            {MODULE_CATALOG.map((row) => {
              const metrics = metricsFor(row, instrument);
              return (
                <li key={row.id} className={moduleStyles.guideItem}>
                  <div className={moduleStyles.guideHead}>
                    <strong>
                      {row.greek !== '—' && row.greek !== 'Preset'
                        ? `Module ${row.greek} — `
                        : ''}
                      {labelFor(row, instrument)}
                    </strong>
                    <span
                      className={`${moduleStyles.badge} ${badgeClass(row)}`}
                    >
                      {taxonomyLabel(row.taxonomy)}
                    </span>
                  </div>
                  <p className={moduleStyles.guideGist}>{row.gist}</p>
                  <ol className={moduleStyles.operateList}>
                    {row.operate.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <p className={moduleStyles.guideMeta}>
                    {metrics ? (
                      <>
                        {instrument === 'points' ? 'Points' : 'Go-out'} skill{' '}
                        {formatSkill(metrics)} · legal moves{' '}
                        {metrics.legalMoves.toFixed(1)} · constrained{' '}
                        {metrics.constrainedPct}% · spread{' '}
                        {metrics.spread.toFixed(1)} · unique pips{' '}
                        {metrics.uniquePips.toFixed(1)}
                      </>
                    ) : (
                      <>Go-out: unavailable (RULES §VI)</>
                    )}
                  </p>
                </li>
              );
            })}
          </ul>
          <p className={styles.p}>
            Full normative text:{' '}
            <Link to="/rules">Navigational Operations Manual § VI</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}

function badgeClass(row: ModuleStatRow): string {
  switch (row.taxonomy) {
    case 'official':
      return moduleStyles.badgeOfficial;
    case 'promote':
      return moduleStyles.badgePromote;
    case 'skill-promote-squad':
      return moduleStyles.badgeGated;
    case 'warped-party':
    case 'warped':
      return moduleStyles.badgeWarped;
  }
}
