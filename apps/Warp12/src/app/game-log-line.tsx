import {
  buildCaptainNameColors,
  splitBodyByNames,
  splitGameLogLine,
  type NameColorEntry,
} from './game-log-display.js';
import styles from './game-log-dialog.module.scss';

export interface GameLogLineProps {
  line: string;
  nameColors?: readonly NameColorEntry[];
}

export function GameLogLine({ line, nameColors = [] }: GameLogLineProps) {
  const parsed = splitGameLogLine(line);

  if (!parsed) {
    return <p className={styles.line}>{line}</p>;
  }

  const segments = splitBodyByNames(parsed.body, nameColors);

  return (
    <p className={styles.line}>
      <span className={styles.timestamp}>{parsed.timestamp}</span>
      {' - '}
      {segments.map((segment, index) =>
        segment.color ? (
          <span
            key={`${index}-${segment.text}`}
            className={styles.captainName}
            style={{ color: segment.color }}
          >
            {segment.text}
          </span>
        ) : (
          <span key={`${index}-${segment.text}`}>{segment.text}</span>
        )
      )}
    </p>
  );
}

export function buildNameColorsFromCaptains(
  names: Readonly<Record<string, string>>,
  captainOrder: readonly string[]
): NameColorEntry[] {
  return buildCaptainNameColors(names, captainOrder);
}
