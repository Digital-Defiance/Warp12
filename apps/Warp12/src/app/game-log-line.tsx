import { getTeiGradeColor } from 'warp12-engine';

import {
  buildCaptainNameColors,
  logPipTextColor,
  splitBodyByNames,
  splitGameLogLine,
  type NameColorEntry,
} from './game-log-display.js';
import styles from './game-log-dialog.module.scss';

export interface GameLogLineProps {
  line: string;
  nameColors?: readonly NameColorEntry[];
  /** Override the default dialog line class (e.g. ticker styling). */
  className?: string;
}

export function GameLogLine({
  line,
  nameColors = [],
  className,
}: GameLogLineProps) {
  const parsed = splitGameLogLine(line);

  if (!parsed) {
    return <p className={className ?? styles.line}>{line}</p>;
  }

  const segments = splitBodyByNames(parsed.body, nameColors);

  return (
    <p className={className ?? styles.line}>
      <span className={styles.timestamp}>{parsed.timestamp}</span>
      {' - '}
      {segments.map((segment, index) => {
        if (segment.tei) {
          const colorClass = getTeiGradeColor(segment.tei.grade);
          const label = segment.tei.reference
            ? `reference ${segment.tei.grade}${segment.tei.score}`
            : `${segment.tei.grade}${segment.tei.score}`;
          return (
            <span
              key={`${index}-${segment.text}`}
              className={styles.teiCell}
              aria-label={label}
            >
              {segment.tei.reference ? (
                <span className={styles.teiRef}>ref </span>
              ) : null}
              <span
                className={`${styles.teiGrade} ${styles[`teiGrade--${colorClass}`]}`}
              >
                {segment.tei.grade}
              </span>
              <span className={styles.teiScore}>{segment.tei.score}</span>
            </span>
          );
        }
        if (segment.coordinate) {
          const { left, right, separator, doubleLabel } = segment.coordinate;
          const spoken = doubleLabel
            ? `Double ${left}-${right}`
            : `${left}:${right}`;
          return (
            <span
              key={`${index}-${segment.text}`}
              className={styles.coordCell}
              aria-label={spoken}
            >
              {doubleLabel ? (
                <span className={styles.coordDoubleLabel}>Double </span>
              ) : null}
              <span
                className={styles.coordPip}
                style={{ color: logPipTextColor(left) }}
              >
                {left}
              </span>
              <span className={styles.coordSep} aria-hidden>
                {separator}
              </span>
              <span
                className={styles.coordPip}
                style={{ color: logPipTextColor(right) }}
              >
                {right}
              </span>
            </span>
          );
        }
        if (segment.color) {
          return (
            <span
              key={`${index}-${segment.text}`}
              className={styles.captainName}
              style={{ color: segment.color }}
            >
              {segment.text}
            </span>
          );
        }
        return <span key={`${index}-${segment.text}`}>{segment.text}</span>;
      })}
    </p>
  );
}

export function buildNameColorsFromCaptains(
  names: Readonly<Record<string, string>>,
  captainOrder: readonly string[]
): NameColorEntry[] {
  return buildCaptainNameColors(names, captainOrder);
}
