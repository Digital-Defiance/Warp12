import type { GameAction } from '@warp12/Warp12-lib';

import { isAiCaptain } from '../game/ai-captain.js';
import type { FirestoreGameDocument } from './schema.js';

export function canHostProxyAiMove(
  doc: FirestoreGameDocument,
  hostId: string,
  aiPlayerId: string
): boolean {
  if (doc.hostId !== hostId) {
    return false;
  }
  const captain = doc.captains.find((entry) => entry.id === aiPlayerId);
  return captain != null && isAiCaptain(captain);
}

export function assertActorMaySubmit(
  docData: FirestoreGameDocument,
  actorId: string,
  action: GameAction
): string | null {
  if (!docData.captainIds.includes(actorId)) {
    return 'NOT_YOUR_TURN';
  }

  if (action.type === 'END_ROUND') {
    if (!docData.round || docData.round.phase !== 'ended') {
      return 'ROUND_NOT_PLAYING';
    }
    if (docData.round.roundBlocked) {
      return action.winnerId === null ? null : 'ROUND_NOT_PLAYING';
    }
    if (action.winnerId !== docData.round.roundWinnerId) {
      return 'ROUND_NOT_PLAYING';
    }
    return null;
  }

  if (action.type === 'DECLARE_TREATY') {
    if (!docData.round || docData.round.phase !== 'playing') {
      return 'ROUND_NOT_PLAYING';
    }
    if (
      !docData.round.treatyDeclarationRequired ||
      docData.round.treatyDeclared
    ) {
      return 'TREATY_NOT_REQUIRED';
    }
    if (action.playerId !== actorId) {
      return 'NOT_YOUR_TURN';
    }
    const { roundWinnerId, activePlayerId } = docData.round;
    const mayDeclare =
      roundWinnerId === actorId ||
      (roundWinnerId == null && activePlayerId === actorId);
    return mayDeclare ? null : 'NOT_YOUR_TURN';
  }

  const actingPlayerId = action.playerId;
  if (actingPlayerId !== actorId) {
    if (!canHostProxyAiMove(docData, actorId, actingPlayerId)) {
      return 'NOT_YOUR_TURN';
    }
  }

  if (!docData.round || docData.round.phase !== 'playing') {
    return 'ROUND_NOT_PLAYING';
  }

  if (docData.round.activePlayerId !== actingPlayerId) {
    return 'NOT_YOUR_TURN';
  }

  return null;
}
