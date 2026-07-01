import type { Coordinate } from './coordinate.js';
import type { Captain, PlayerId } from './player.js';
import type { GameModules } from './modules.js';
import type { RoundState } from './game-state.js';

/** Catalog of reality-bending Q-Flash effects (Module Alpha). */
export type QFlashEffectKind =
  | 'reverse-turn-order'
  | 'skip-lowest-points'
  | 'peek-uncharted'
  | 'temporal-inversion'
  | 'distress-amplification'
  | 'fracture-immunity'
  | 'salamander-swap'
  | 'all-stop-echo'
  | 'q-gamble';

export interface QFlashEffect {
  readonly kind: QFlashEffectKind;
  readonly targetPlayerId?: PlayerId;
  readonly peek?: Readonly<{ index: number; coordinate: Coordinate }>;
}

export interface QRoundEffects {
  readonly reverseTurnOrder: boolean;
  /** Reverse turn order until the next double is charted. */
  readonly temporalInversion: boolean;
  /** All warp trails are open without a Distress Beacon. */
  readonly openAllTrails: boolean;
  /** The next double on an own trail will not open Subspace Fracture. */
  readonly suppressNextFracture: boolean;
  /** Captains who lose their next helm activation once. */
  readonly skipNextTurnFor: readonly PlayerId[];
  readonly peekedSector: Readonly<{
    index: number;
    coordinate: Coordinate;
    visibleTo: PlayerId;
  }> | null;
  /** At round scoring, 12-12 penalty transfers to the highest-points captain. */
  readonly salamanderSwap: boolean;
  /** Any round win requires calling All Stop! before scoring. */
  readonly allStopEcho: boolean;
}

export interface QGamblePending {
  readonly playerId: PlayerId;
  readonly options: readonly [Coordinate, Coordinate];
}

export interface QFlashCatalogEntry {
  readonly kind: QFlashEffectKind;
  readonly label: string;
  readonly description: string;
  readonly requiresSalamander?: boolean;
}

export const Q_FLASH_CATALOG: readonly QFlashCatalogEntry[] = [
  {
    kind: 'reverse-turn-order',
    label: 'Reverse turn order',
    description: 'Helm passes counter-clockwise for the rest of the round.',
  },
  {
    kind: 'skip-lowest-points',
    label: 'Skip lowest points',
    description:
      'The captain with the lowest campaign points score skips their next turn.',
  },
  {
    kind: 'peek-uncharted',
    label: 'Peek Uncharted Sector',
    description: 'Reveal the top tile in the Uncharted Sectors (invoker only).',
  },
  {
    kind: 'temporal-inversion',
    label: 'Temporal inversion',
    description:
      'Turn order reverses until the next double is charted on the table.',
  },
  {
    kind: 'distress-amplification',
    label: 'Distress amplification',
    description:
      'All warp trails stay open to every captain for the rest of the round.',
  },
  {
    kind: 'fracture-immunity',
    label: 'Fracture immunity',
    description:
      'The next double charted on an own trail will not open Subspace Fracture.',
  },
  {
    kind: 'salamander-swap',
    label: 'Salamander swap',
    description:
      'If anyone holds 12-12 at round end, that penalty applies to the highest-points captain instead.',
    requiresSalamander: true,
  },
  {
    kind: 'all-stop-echo',
    label: 'All Stop! echo',
    description:
      'Any captain going out this round must call All Stop! before the sector closes.',
  },
  {
    kind: 'q-gamble',
    label: "Q's gamble",
    description:
      'Draw two tiles from Uncharted Sectors — keep one, return the other face-down.',
  },
];

export const EMPTY_Q_ROUND_EFFECTS: QRoundEffects = {
  reverseTurnOrder: false,
  temporalInversion: false,
  openAllTrails: false,
  suppressNextFracture: false,
  skipNextTurnFor: [],
  peekedSector: null,
  salamanderSwap: false,
  allStopEcho: false,
};

export function describeQFlashEffect(
  effect: QFlashEffect,
  names: Readonly<Record<string, string>>
): string {
  const entry = Q_FLASH_CATALOG.find((item) => item.kind === effect.kind);
  const base = entry?.label ?? effect.kind;
  if (effect.kind === 'skip-lowest-points' && effect.targetPlayerId) {
    return `${base}: ${names[effect.targetPlayerId] ?? effect.targetPlayerId}`;
  }
  if (effect.kind === 'peek-uncharted' && effect.peek) {
    const { low, high } = effect.peek.coordinate;
    return `${base}: ${low}-${high}`;
  }
  return base;
}

export function getAvailableQFlashEffects(
  round: RoundState,
  modules: GameModules,
  captains: readonly Captain[]
): QFlashEffectKind[] {
  return Q_FLASH_CATALOG.filter((entry) => {
    if (entry.requiresSalamander && !modules.salamanderPenalty.enabled) {
      return false;
    }
    switch (entry.kind) {
      case 'peek-uncharted':
        return round.unchartedSectors.length > 0;
      case 'q-gamble':
        return round.unchartedSectors.length >= 2;
      case 'skip-lowest-points':
        return captains.length > 1;
      default:
        return true;
    }
  }).map((entry) => entry.kind);
}

export function isQResolutionPending(round: RoundState): boolean {
  return round.qPendingInvoker !== null || round.qGamblePending !== null;
}
