import {
  getLegalMoves,
  type ChartRoute,
  type Coordinate,
  type GameAction,
  type GameState,
  type LegalMove,
  type RoundState,
} from 'warp12-engine';
import type { WarpTileBg } from 'warp12-theme';

export const HAND_COMPANION_CHANNEL = 'warp12-hand-companion-v1';
export const LOCAL_HAND_COMPANION_PATH = '/local/hand';

/** Public docs site streamer guide. */
export const STREAMER_MANUAL_URL = 'https://docs.warp12.app/streamer-manual';

export interface HandCompanionHelmFlags {
  readonly showDraw: boolean;
  readonly showDesperationDig: boolean;
  readonly showShieldsDown: boolean;
  readonly showShieldsUp: boolean;
  readonly showPassRedAlert: boolean;
  readonly showPass: boolean;
}

export interface HandCompanionSpoolOption {
  readonly route: ChartRoute;
  readonly label: string;
}

export interface HandCompanionSnapshotMessage {
  readonly type: 'snapshot';
  readonly gameId: string;
  readonly maxPip: number;
  readonly handOwnerId: string;
  readonly handOwnerName: string;
  readonly isMyTurn: boolean;
  readonly phase: string;
  readonly status: string;
  readonly hand: readonly Coordinate[];
  readonly legalMoves: readonly LegalMove[];
  readonly helm: HandCompanionHelmFlags;
  readonly spoolOptions: readonly HandCompanionSpoolOption[];
  readonly dropToImpulsePending: boolean;
  readonly canCatchDropToImpulse: boolean;
  readonly dropToImpulseCatchTargetId: string | null;
  readonly dropToImpulseCatchLabel: string | null;
  readonly names: Readonly<Record<string, string>>;
  /**
   * GameState with other captains' hands / draft packs redacted for this seat.
   */
  readonly game: GameState | null;
  readonly tileBg: WarpTileBg;
  readonly handoffPending: boolean;
  readonly handoffCaptainName: string | null;
  readonly at: string;
}

export interface HandCompanionHelloMessage {
  readonly type: 'hello';
}

export interface HandCompanionActionMessage {
  readonly type: 'action';
  readonly action: GameAction;
}

export interface HandCompanionHandoffReadyMessage {
  readonly type: 'handoff-ready';
  readonly seatId: string;
}

export interface HandCompanionRosterMessage {
  readonly type: 'roster';
  readonly seats: readonly { readonly id: string; readonly displayName: string }[];
  readonly gameId: string;
}

export type HandCompanionOutboundMessage =
  | HandCompanionSnapshotMessage
  | HandCompanionHelloMessage
  | HandCompanionRosterMessage;

export type HandCompanionInboundMessage =
  | HandCompanionActionMessage
  | HandCompanionHelloMessage
  | HandCompanionHandoffReadyMessage;

export function isHandCompanionOutboundMessage(
  value: unknown
): value is HandCompanionOutboundMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === 'snapshot' || type === 'hello' || type === 'roster';
}

export function isHandCompanionInboundMessage(
  value: unknown
): value is HandCompanionInboundMessage {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === 'action' || type === 'hello' || type === 'handoff-ready';
}

/** Per-seat BroadcastChannel name (couch mode). */
export function handCompanionChannelForSeat(seatId: string): string {
  return `${HAND_COMPANION_CHANNEL}:${seatId}`;
}

export function localHandCompanionPath(seatId?: string): string {
  if (!seatId) {
    return LOCAL_HAND_COMPANION_PATH;
  }
  return `${LOCAL_HAND_COMPANION_PATH}/${encodeURIComponent(seatId)}`;
}

/**
 * Strip private tiles belonging to other captains before shipping a companion
 * snapshot (BroadcastChannel is same-origin but still avoid multi-seat leaks).
 */
export function redactGameForSeat(
  game: GameState,
  seatId: string
): GameState {
  const round = game.round;
  if (!round) {
    return game;
  }

  const hands: Record<string, readonly Coordinate[]> = {};
  for (const [id, tiles] of Object.entries(round.hands)) {
    hands[id] = id === seatId ? tiles : [];
  }

  let draftState = round.draftState;
  if (draftState) {
    const currentPacks: Record<string, readonly Coordinate[]> = {};
    const pickedTiles: Record<string, readonly Coordinate[]> = {};
    for (const id of draftState.draftOrder) {
      currentPacks[id] =
        id === seatId ? (draftState.currentPacks[id] ?? []) : [];
      pickedTiles[id] =
        id === seatId ? (draftState.pickedTiles[id] ?? []) : [];
    }
    draftState = {
      ...draftState,
      currentPacks,
      pickedTiles,
    };
  }

  const nextRound: RoundState = {
    ...round,
    hands,
    draftState,
  };
  return { ...game, round: nextRound };
}

function withChannel(
  channelName: string,
  run: (channel: BroadcastChannel) => void
): void {
  if (typeof BroadcastChannel === 'undefined') {
    return;
  }
  try {
    const channel = new BroadcastChannel(channelName);
    run(channel);
    channel.close();
  } catch {
    // Cross-origin / unsupported
  }
}

export function publishHandCompanionSnapshot(
  snapshot: Omit<HandCompanionSnapshotMessage, 'type' | 'at'> & {
    readonly at?: string;
  },
  channelName: string = HAND_COMPANION_CHANNEL
): void {
  withChannel(channelName, (channel) => {
    const message: HandCompanionSnapshotMessage = {
      type: 'snapshot',
      ...snapshot,
      at: snapshot.at ?? new Date().toISOString(),
    };
    channel.postMessage(message);
  });
}

export function publishHandCompanionHello(
  channelName: string = HAND_COMPANION_CHANNEL
): void {
  withChannel(channelName, (channel) => {
    const message: HandCompanionHelloMessage = { type: 'hello' };
    channel.postMessage(message);
  });
}

export function publishHandCompanionRoster(
  roster: Omit<HandCompanionRosterMessage, 'type'>
): void {
  withChannel(HAND_COMPANION_CHANNEL, (channel) => {
    const message: HandCompanionRosterMessage = {
      type: 'roster',
      ...roster,
    };
    channel.postMessage(message);
  });
}

export function publishHandCompanionAction(
  action: GameAction,
  channelName: string = HAND_COMPANION_CHANNEL
): void {
  withChannel(channelName, (channel) => {
    const message: HandCompanionActionMessage = { type: 'action', action };
    channel.postMessage(message);
  });
}

export function publishHandCompanionHandoffReady(
  seatId: string,
  channelName: string = handCompanionChannelForSeat(seatId)
): void {
  withChannel(channelName, (channel) => {
    const message: HandCompanionHandoffReadyMessage = {
      type: 'handoff-ready',
      seatId,
    };
    channel.postMessage(message);
  });
}

export function openLocalHandCompanionWindow(
  seatId?: string
): Window | null {
  if (typeof window === 'undefined') {
    return null;
  }
  const path = localHandCompanionPath(seatId);
  const url = new URL(path, window.location.origin);
  const windowName = seatId
    ? `warp12-local-hand-${seatId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
    : 'warp12-local-hand';
  return window.open(
    url.toString(),
    windowName,
    'popup=yes,width=1100,height=520'
  );
}

export function openCouchHandWindows(
  seats: readonly { readonly id: string }[]
): void {
  for (const seat of seats) {
    openLocalHandCompanionWindow(seat.id);
  }
}

/** Legal moves for a seat (empty when not their turn). */
export function legalMovesForSeat(
  round: RoundState | null | undefined,
  seatId: string,
  isSeatTurn: boolean,
  houseRules: GameState['houseRules']
): readonly LegalMove[] {
  if (!round || !isSeatTurn) {
    return [];
  }
  return getLegalMoves(round, seatId, houseRules);
}
