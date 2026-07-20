import type { NameColorEntry } from './game-log-display.js';
import { GameLogLine } from './game-log-line.js';
import styles from './game-log-ticker.module.scss';

export type GameLogTickerVariant = 'fleet' | 'commentator';

export interface GameLogTickerProps {
  lines: readonly string[];
  nameColors?: readonly NameColorEntry[];
  /** Stream-oriented layout for commentator mode. */
  variant?: GameLogTickerVariant;
  /** Multiplier for line font size (1 = default). */
  fontScale?: number;
}

/** Visual-only scrolling feed — open the log via the book HUD control. */
export function GameLogTicker({
  lines,
  nameColors = [],
  variant = 'fleet',
  fontScale = 1,
}: GameLogTickerProps) {
  if (lines.length === 0) {
    return null;
  }

  const commentator = variant === 'commentator';

  return (
    <div
      className={`${styles.bridgeLog}${commentator ? ` ${styles.bridgeLogCommentator}` : ''}`}
      aria-hidden
      data-variant={variant}
      style={{ ['--log-font-scale' as string]: String(fontScale) }}
    >
      <div className={styles.feed}>
        {lines.map((line, index) => (
          <GameLogLine
            key={`${index}-${line}`}
            line={line}
            nameColors={nameColors}
            className={`${styles.line}${
              commentator ? ` ${styles.lineCommentator}` : ''
            }${index === lines.length - 1 ? ` ${styles.lineLatest}` : ''}`}
          />
        ))}
      </div>
    </div>
  );
}
