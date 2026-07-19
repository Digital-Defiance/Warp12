import type { NameColorEntry } from './game-log-display.js';
import { GameLogLine } from './game-log-line.js';
import styles from './game-log-ticker.module.scss';

export interface GameLogTickerProps {
  lines: readonly string[];
  nameColors?: readonly NameColorEntry[];
}

/** Visual-only scrolling feed — open the log via the book HUD control. */
export function GameLogTicker({ lines, nameColors = [] }: GameLogTickerProps) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <div className={styles.bridgeLog} aria-hidden>
      <div className={styles.feed}>
        {lines.map((line, index) => (
          <GameLogLine
            key={`${index}-${line}`}
            line={line}
            nameColors={nameColors}
            className={`${styles.line}${
              index === lines.length - 1 ? ` ${styles.lineLatest}` : ''
            }`}
          />
        ))}
      </div>
    </div>
  );
}
