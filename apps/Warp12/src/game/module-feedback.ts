import type { GameAction, GameState } from 'warp12-engine';
import type { GameLogEntry } from 'warp12-react';

export interface DoubleDownNotice {
  readonly targetCaptainId: string;
  readonly drawCount: number;
  readonly fromCaptainId: string;
}

export function doubleDownNoticeFromEntry(
  entry: GameLogEntry
): DoubleDownNotice | null {
  if (!entry.doubleDown) {
    return null;
  }
  return {
    targetCaptainId: entry.doubleDown.targetCaptainId,
    drawCount: entry.doubleDown.drawCount,
    fromCaptainId: entry.captainId,
  };
}

export function formatDoubleDownFeedback(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  viewerId: string
): string | null {
  if (!entry.doubleDown) {
    return null;
  }
  const { targetCaptainId, drawCount } = entry.doubleDown;
  const fromName = names[entry.captainId] ?? entry.captainId;
  const drawPhrase =
    drawCount === 1 ? '1 tile' : `${drawCount} tiles`;

  if (targetCaptainId === viewerId) {
    return `Double Down! You drew ${drawPhrase} from Uncharted Sectors`;
  }
  const targetName = names[targetCaptainId] ?? targetCaptainId;
  return `Double Down! ${fromName} charted a double — ${targetName} drew ${drawPhrase}`;
}

export function formatSpoolFeedback(input: {
  before: GameState;
  after: GameState;
  action: Extract<GameAction, { type: 'SPOOL_WARP_DRIVE' }>;
  entry: GameLogEntry | null;
  names: Readonly<Record<string, string>>;
  viewerId: string;
}): string | null {
  const { before, after, action, entry, names, viewerId } = input;
  const tilesPlayed = entry?.spoolDetails?.tilesPlayed ?? 0;
  const handBefore = before.round?.hands[action.playerId]?.length ?? 0;
  const handAfter = after.round?.hands[action.playerId]?.length ?? 0;
  const mismatchCount = handAfter - handBefore;
  const playedPhrase =
    tilesPlayed === 1 ? '1 tile' : `${tilesPlayed} tiles`;

  if (action.playerId === viewerId) {
    if (mismatchCount > 0) {
      const mismatchPhrase =
        mismatchCount === 1 ? '1 mismatch' : `${mismatchCount} mismatches`;
      return `Spooled ${playedPhrase} — drew ${mismatchPhrase} to hand`;
    }
    return `Spooled ${playedPhrase}`;
  }

  const actor = names[action.playerId] ?? action.playerId;
  return `${actor} spooled ${playedPhrase}`;
}

export function formatModuleFeedbackFromLogEntry(
  entry: GameLogEntry,
  names: Readonly<Record<string, string>>,
  viewerId: string
): string | null {
  if (entry.kind === 'CHART_COORDINATE' && entry.doubleDown) {
    return formatDoubleDownFeedback(entry, names, viewerId);
  }
  if (entry.kind === 'SPOOL_WARP_DRIVE' && entry.spoolDetails) {
    const actor = names[entry.captainId] ?? entry.captainId;
    const played = entry.spoolDetails.tilesPlayed;
    const playedPhrase = played === 1 ? '1 tile' : `${played} tiles`;
    if (entry.captainId === viewerId) {
      return `Spooled ${playedPhrase}`;
    }
    return `${actor} spooled ${playedPhrase}`;
  }
  return null;
}
