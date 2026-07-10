import type { FC } from 'react';

import styles from './factor-landing.module.scss';
import { Warp12Logo } from './Warp12Logo';
import { setWarpFactor, useQueryWarpFactor } from './warp-factor';

const FACTORS = [
  {
    factor: 9,
    setName: 'Double-9',
    tiles: '55 tiles',
    players: '2 to 4 Players',
    description: 'Perfect for small, fast tactical sessions.',
  },
  {
    factor: 12,
    setName: 'Double-12',
    tiles: '91 tiles',
    players: '2 to 8 Players',
    description: "The sweet spot for standard play; your engine's default.",
    badge: 'RECOMMENDED',
  },
  {
    factor: 15,
    setName: 'Double-15',
    tiles: '136 tiles',
    players: '2 to 12 Players',
    description:
      'Larger party tables — hub grows past eight spokes with a dedicated Neutral Zone arm.',
  },
  {
    factor: 18,
    setName: 'Double-18',
    tiles: '190 tiles',
    players: '2 to 18 Players',
    description:
      'The absolute behemoth. Massive fleets; expect a wider table and denser spokes.',
  },
] as const;

export const FactorLanding: FC = () => {
  const selectFactor = (factor: number) => {
    setWarpFactor(factor);
    window.location.assign('/');
  };

  const queryFactor = useQueryWarpFactor();
  if (queryFactor !== undefined) {
    selectFactor(queryFactor);
  }

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <h1 className={styles.title}>Prepare to Engage</h1>
        <p className={styles.lead}>
          Choose your factor to engage in a thrilling journey of discovery and
          adventure.
        </p>
        <div className={styles.factorGrid}>
          {FACTORS.map((entry) => (
            <button
              key={entry.factor}
              type="button"
              className={styles.factorCard}
              onClick={() => selectFactor(entry.factor)}
            >
              <div className={styles.logo}>
                <Warp12Logo factor={entry.factor} taglineOff width={150} />
              </div>
              <div className={styles.meta}>
                <div className={styles.metaHeader}>
                  <h2 className={styles.setName}>{entry.setName}</h2>
                  {'badge' in entry && entry.badge ? (
                    <span className={styles.badge}>{entry.badge}</span>
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
