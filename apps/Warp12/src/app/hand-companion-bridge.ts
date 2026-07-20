import {
  HAND_COMPANION_CHANNEL,
  handCompanionChannelForSeat,
} from './hand-companion-broadcast.js';

export interface CompanionSeat {
  readonly id: string;
  readonly displayName: string;
}

/**
 * Whether pass-and-play should show the shared-device handoff gate.
 * Couch mode skips it — each seat has its own private hand window.
 */
export function isCompanionHandoffEnabled(couchMode: boolean): boolean {
  return !couchMode;
}

/**
 * Resolve which human seats get private companion channels.
 */
export function resolveCompanionHumanSeats(args: {
  readonly mode: string;
  readonly isOnline: boolean;
  readonly isVsAi: boolean;
  readonly humanId: string;
  readonly humanName?: string;
  readonly humanCaptains?: readonly CompanionSeat[];
  readonly names: Readonly<Record<string, string>>;
}): readonly CompanionSeat[] {
  if (args.mode !== 'local' || args.isOnline) {
    return [];
  }
  if (args.humanCaptains && args.humanCaptains.length > 0) {
    return args.humanCaptains.map((human) => ({
      id: human.id,
      displayName: human.displayName,
    }));
  }
  if (args.isVsAi) {
    return [
      {
        id: args.humanId,
        displayName:
          args.names[args.humanId] ?? args.humanName ?? 'You',
      },
    ];
  }
  return [];
}

/**
 * Follow-active seat for the base `/local/hand` channel (streamer single window).
 */
export function resolveFollowCompanionSeatId(args: {
  readonly isLocalPassAndPlay: boolean;
  readonly activePlayerId: string;
  readonly humanSeatIds: ReadonlySet<string>;
  readonly companionSeats: readonly CompanionSeat[];
  readonly humanId: string;
}): string | null {
  if (args.isLocalPassAndPlay) {
    if (
      args.activePlayerId &&
      args.humanSeatIds.has(args.activePlayerId)
    ) {
      return args.activePlayerId;
    }
    return args.companionSeats[0]?.id ?? null;
  }
  return args.humanId || null;
}

/**
 * Whether an inbound companion action on `channelName` may be applied.
 * Follow channel: only the current hand owner. Seat channel: only that seat,
 * and only if they are a known human.
 */
export function shouldAcceptCompanionAction(args: {
  readonly channelName: string;
  readonly actorId: string;
  readonly handOwnerId: string;
  readonly humanSeatIds: ReadonlySet<string>;
  readonly humanId: string;
}): boolean {
  if (!args.actorId) {
    return false;
  }
  if (args.channelName === HAND_COMPANION_CHANNEL) {
    return args.actorId === args.handOwnerId;
  }
  const seatPrefix = `${HAND_COMPANION_CHANNEL}:`;
  if (!args.channelName.startsWith(seatPrefix)) {
    return false;
  }
  const seatId = args.channelName.slice(seatPrefix.length);
  if (!seatId || args.actorId !== seatId) {
    return false;
  }
  return (
    args.humanSeatIds.has(args.actorId) || args.actorId === args.humanId
  );
}

/**
 * Whether a handoff-ready ping should clear the Bridge handoff gate.
 */
export function shouldAcceptCompanionHandoffReady(args: {
  readonly channelName: string;
  readonly readySeatId: string;
  readonly activePlayerId: string;
  readonly handOwnerId: string;
}): boolean {
  if (args.readySeatId === args.activePlayerId) {
    return true;
  }
  return (
    args.channelName === HAND_COMPANION_CHANNEL &&
    args.handOwnerId === args.activePlayerId
  );
}

/** Channel names the Bridge should listen on for a seat roster. */
export function companionListenChannels(
  seats: readonly CompanionSeat[]
): readonly string[] {
  return [
    HAND_COMPANION_CHANNEL,
    ...seats.map((seat) => handCompanionChannelForSeat(seat.id)),
  ];
}
