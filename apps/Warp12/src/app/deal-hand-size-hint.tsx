import {
  handSizeForPlayerCount,
  LARGE_FLEET_PLAYER_COUNTS,
  type LargeFleetHandSize,
} from 'warp12-engine';

import styles from './lobby.module.scss';

export function isLargeFleetHandSizeChoiceVisible(playerCount: number): boolean {
  return LARGE_FLEET_PLAYER_COUNTS.includes(playerCount);
}

export interface DealHandSizeHintProps {
  playerCount: number;
  maxPip: number;
  largeFleetHandSize?: LargeFleetHandSize;
}

/** Read-only deal size for the current fleet — avoids confusing 10/11 with 9+ tables. */
export function DealHandSizeHint({
  playerCount,
  maxPip,
  largeFleetHandSize = 10,
}: DealHandSizeHintProps) {
  if (playerCount < 2) return null;

  let size: number;
  try {
    size = handSizeForPlayerCount(playerCount, largeFleetHandSize, maxPip);
  } catch {
    return null;
  }

  const configurable = isLargeFleetHandSizeChoiceVisible(playerCount);

  return (
    <p className={styles.hint} role="status">
      Each captain is dealt <strong>{size}</strong> coordinate
      {size === 1 ? '' : 's'} at {playerCount} captains
      {configurable
        ? ' (adjustable below for 7–8).'
        : ' (fixed for this Warp set / fleet size).'}
    </p>
  );
}
