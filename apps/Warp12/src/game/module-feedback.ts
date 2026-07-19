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

function spoolAbortPhrase(isViewer: boolean): string {
  return isViewer
    ? 'unfinished double retrieved to hand — no Red Alert'
    : 'unfinished double retrieved — no Red Alert';
}

export function formatSpoolFeedback(input: {
  before: GameState;
  after: GameState;
  action: Extract<GameAction, { type: 'SPOOL_WARP_DRIVE' }>;
  entry: GameLogEntry | null;
  names: Readonly<Record<string, string>>;
  viewerId: string;
}): string | null {
  const { after, action, entry, names, viewerId } = input;
  const tilesPlayed = entry?.spoolDetails?.tilesPlayed ?? 0;
  const tilesToHand =
    entry?.spoolDetails?.tilesToHand ??
    Math.max(
      0,
      (after.round?.hands[action.playerId]?.length ?? 0) -
        (input.before.round?.hands[action.playerId]?.length ?? 0)
    );
  const aborted =
    entry?.spoolDetails?.abortedUnfinishedDouble === true ||
    entry?.effects.includes('spool-abort-retrieve') === true ||
    after.round?.spoolAbortRetrieve === true;
  const playedPhrase =
    tilesPlayed === 1 ? '1 tile' : `${tilesPlayed} tiles`;
  const isViewer = action.playerId === viewerId;
  const actor = names[action.playerId] ?? action.playerId;

  if (aborted) {
    if (tilesPlayed > 0) {
      return isViewer
        ? `Spooled ${playedPhrase} — ${spoolAbortPhrase(true)}`
        : `${actor} spooled ${playedPhrase} — ${spoolAbortPhrase(false)}`;
    }
    return isViewer
      ? `Spool aborted — ${spoolAbortPhrase(true)}`
      : `${actor}'s spool aborted — ${spoolAbortPhrase(false)}`;
  }

  if (isViewer) {
    if (tilesToHand > 0) {
      const mismatchPhrase =
        tilesToHand === 1 ? '1 mismatch' : `${tilesToHand} mismatches`;
      return `Spooled ${playedPhrase} — drew ${mismatchPhrase} to hand`;
    }
    return `Spooled ${playedPhrase}`;
  }

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
    const aborted =
      entry.spoolDetails.abortedUnfinishedDouble === true ||
      entry.effects.includes('spool-abort-retrieve');
    const isViewer = entry.captainId === viewerId;

    if (aborted) {
      if (played > 0) {
        return isViewer
          ? `Spooled ${playedPhrase} — ${spoolAbortPhrase(true)}`
          : `${actor} spooled ${playedPhrase} — ${spoolAbortPhrase(false)}`;
      }
      return isViewer
        ? `Spool aborted — ${spoolAbortPhrase(true)}`
        : `${actor}'s spool aborted — ${spoolAbortPhrase(false)}`;
    }

    if (isViewer) {
      const toHand = entry.spoolDetails.tilesToHand ?? 0;
      if (toHand > 0) {
        const mismatchPhrase =
          toHand === 1 ? '1 mismatch' : `${toHand} mismatches`;
        return `Spooled ${playedPhrase} — drew ${mismatchPhrase} to hand`;
      }
      return `Spooled ${playedPhrase}`;
    }
    return `${actor} spooled ${playedPhrase}`;
  }
  return null;
}
