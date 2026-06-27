import type { Coordinate } from './coordinate.js';
import type { GameObjective } from './objective.js';
import type { PlayerId } from './player.js';
import type { NeutralZone, Spacedock, WarpTrail } from './trails.js';
import type { RedAlert, SubspaceFracture } from './anomalies.js';
import type { QGamblePending, QRoundEffects } from './q-continuum.js';

export type GamePhase = 'lobby' | 'active' | 'round-end' | 'complete';

export type RoundPhase = 'setup' | 'playing' | 'ended';

export interface TableState {
  readonly spacedock: Spacedock;
  readonly warpTrails: Readonly<Record<PlayerId, WarpTrail>>;
  readonly neutralZone: NeutralZone;
  readonly subspaceFracture: SubspaceFracture | null;
  readonly redAlert: RedAlert | null;
}

export interface RoundState {
  readonly roundNumber: number;
  readonly spacedockValue: number;
  readonly phase: RoundPhase;
  readonly activePlayerId: PlayerId;
  readonly turnOrder: readonly PlayerId[];
  readonly table: TableState;
  readonly unchartedSectors: readonly Coordinate[];
  readonly hands: Readonly<Record<PlayerId, readonly Coordinate[]>>;
  readonly treatyDeclarationRequired: boolean;
  readonly treatyDeclared: boolean;
  readonly roundWinnerId: PlayerId | null;
  /** Captain who must invoke a Q-Flash after charting 0-0. */
  readonly qPendingInvoker: PlayerId | null;
  /** Active Q-Flash mechanical effects for this round. */
  readonly qEffects: QRoundEffects | null;
  /** Awaiting keep/discard after Q's gamble. */
  readonly qGamblePending: QGamblePending | null;
}

export interface GameState {
  readonly id: string;
  readonly phase: GamePhase;
  readonly captains: readonly import('./player.js').Captain[];
  readonly round: RoundState | null;
  readonly completedRounds: number;
  readonly modules: import('./modules.js').GameModules;
  /** Fleet victory condition — penalty campaign vs first captain out. */
  readonly objective: GameObjective;
}

export interface CreateGameInput {
  readonly id: string;
  readonly captains: readonly { id: string; displayName: string }[];
  readonly modules?: import('./modules.js').GameModuleConfig;
  readonly objective?: GameObjective;
}

export interface CreateRoundInput {
  readonly roundNumber: number;
  readonly captains: readonly import('./player.js').Captain[];
  readonly shuffledCoordinates: readonly Coordinate[];
  readonly roundStarterId?: PlayerId;
}
