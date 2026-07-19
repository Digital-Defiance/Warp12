import { useRef, type FC } from 'react';

import { useAnnounce } from '../a11y/live-announcer.js';
import styles from './factor-landing.module.scss';
import { Warp12Logo } from './Warp12Logo';
import {
  clearWarpFactor,
  getWarpFactor,
  setWarpFactor,
  useQueryWarpFactor,
} from './warp-factor';

const FACTORS = [
  {
    factor: 9,
    setName: 'Double-9',
    tiles: '55 tiles',
    players: '2 to 4 Players',
    description:
      'Perfect for small, fast tactical sessions. Exhibition — unrated vs TEI.',
    badge: 'EXHIBITION',
  },
  {
    factor: 12,
    setName: 'Double-12',
    tiles: '91 tiles',
    players: '2 to 8 Players',
    description:
      "The sweet spot for standard play and rated TEI ladders; your engine's default.",
    badge: 'RECOMMENDED',
  },
  {
    factor: 15,
    setName: 'Double-15',
    tiles: '136 tiles',
    players: '2 to 12 Players',
    description:
      'Larger party tables — hub grows past eight spokes with a dedicated Neutral Zone arm. Exhibition — unrated vs TEI.',
    badge: 'EXHIBITION',
  },
  {
    factor: 18,
    setName: 'Double-18',
    tiles: '190 tiles',
    players: '2 to 18 Players',
    description:
      'The absolute behemoth. Massive fleets; expect a wider table and denser spokes. Exhibition — unrated vs TEI.',
    badge: 'EXHIBITION',
  },
] as const;

/** Hidden recording reset: five taps on Warp 12 while it is already saved. */
const CLEAR_TAP_COUNT = 5;
const CLEAR_TAP_WINDOW_MS = 900;

export const FactorLanding: FC = () => {
  const announce = useAnnounce();
  const warp12ClearRef = useRef<{
    count: number;
    timer: ReturnType<typeof setTimeout> | null;
  }>({ count: 0, timer: null });

  const selectFactor = (factor: number) => {
    setWarpFactor(factor);
    window.location.assign('/');
  };

  const handleFactorClick = (factor: number) => {
    const arm = warp12ClearRef.current;

    // Easter egg for video takes: already on Warp 12 → mash it 5× to clear.
    if (factor === 12 && getWarpFactor() === 12) {
      if (arm.timer) {
        clearTimeout(arm.timer);
      }
      arm.count += 1;
      if (arm.count >= CLEAR_TAP_COUNT) {
        arm.count = 0;
        arm.timer = null;
        clearWarpFactor();
        announce('Warp factor cleared.', 'polite');
        window.location.assign('/factor');
        return;
      }
      arm.timer = setTimeout(() => {
        arm.count = 0;
        arm.timer = null;
        selectFactor(12);
      }, CLEAR_TAP_WINDOW_MS);
      return;
    }

    if (arm.timer) {
      clearTimeout(arm.timer);
    }
    arm.count = 0;
    arm.timer = null;
    selectFactor(factor);
  };

  const queryFactor = useQueryWarpFactor();
  if (queryFactor !== undefined) {
    selectFactor(queryFactor);
  }

  const logoFactor = queryFactor ?? getWarpFactor();

  return (
    <div className={styles.page}>
    <div className={styles.logoContainer}>
        <Warp12Logo
          width={400}
          factor={logoFactor}
        />
      </div>
      <section className={styles.hero}>
        <h1 className={styles.title}>Prepare to Engage</h1>
        <p className={styles.lead}>
          Choose your factor. Warp 12 is the rated TEI ladder; Warp 9 / 15 / 18
          are exhibition sets for larger (or smaller) tables.
        </p>
        <div className={styles.factorGrid}>
          {FACTORS.map((entry) => (
            <button
              key={entry.factor}
              type="button"
              className={styles.factorCard}
              onClick={() => handleFactorClick(entry.factor)}
            >
              <div className={styles.logo}>
                <Warp12Logo factor={entry.factor} taglineOff width={150} />
              </div>
              <div className={styles.meta}>
                <div className={styles.metaHeader}>
                  <h2 className={styles.setName}>{entry.setName}</h2>
                  {entry.badge ? (
                    <span
                      className={styles.badge}
                      data-kind={
                        entry.badge === 'RECOMMENDED' ? 'recommended' : 'exhibition'
                      }
                    >
                      {entry.badge}
                    </span>
                  ) : null}
                </div>
                <p className={styles.stats}>
                  <span>{entry.tiles}</span>
                  <span className={styles.statSep} aria-hidden>
                    ·
                  </span>
                  <span>{entry.players}</span>
                </p>
                <p className={styles.description}>{entry.description}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};
