import type { KeyboardEvent } from 'react';
import styles from './game-log-ticker.module.scss';

export interface GameLogTickerProps {
  lines: readonly string[];
  clickable?: boolean;
  onOpen?: () => void;
}

export function GameLogTicker({
  lines,
  clickable = false,
  onOpen,
}: GameLogTickerProps) {
  if (lines.length === 0) {
    return null;
  }

  const handleClick = () => {
    if (clickable && onOpen) {
      onOpen();
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!clickable || !onOpen) {
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };

  return (
    <div
      className={`${styles.bridgeLog}${clickable ? ` ${styles.bridgeLogClickable}` : ''}`}
      {...(clickable
        ? {
            role: 'button' as const,
            tabIndex: 0,
            'aria-label': 'Open round log',
          }
        : { 'aria-hidden': true as const })}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={styles.feed}>
        {lines.map((line, index) => (
          <p
            key={`${index}-${line}`}
            className={`${styles.line}${
              index === lines.length - 1 ? ` ${styles.lineLatest}` : ''
            }`}
          >
            {line}
          </p>
        ))}
      </div>
    </div>
  );
}
