import type { GameAction } from 'warp12-engine';

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

function dropToImpulseEnabled(docData: FirestoreGameDocument): boolean {
  return docData.houseRules?.dropToImpulseCall === true;
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

  if (action.type === 'SALAMANDER_PENALTY') {
    // Log annotation only — never submitted as an online move.
    return 'PASS_NOT_ALLOWED';
  }

  if (action.type === 'LONGEST_TRAIL_BONUS') {
    return 'PASS_NOT_ALLOWED';
  }

  if (action.type === 'TEMPORAL_DEBT_PENALTY') {
    return 'PASS_NOT_ALLOWED';
  }

  if (action.type === 'ALL_STOP') {
    if (!docData.round || docData.round.phase !== 'playing') {
      return 'ROUND_NOT_PLAYING';
    }
    if (
      !docData.round.allStopRequired ||
      docData.round.allStopDeclared
    ) {
      return 'ALL_STOP_NOT_REQUIRED';
    }

    const declaringPlayerId = action.playerId;
    const isSelf = declaringPlayerId === actorId;
    const isHostProxy =
      !isSelf && canHostProxyAiMove(docData, actorId, declaringPlayerId);
    if (!isSelf && !isHostProxy) {
      return 'NOT_YOUR_TURN';
    }

    const { roundWinnerId, activePlayerId } = docData.round;
    const mayDeclare =
      roundWinnerId === declaringPlayerId ||
      (roundWinnerId == null && activePlayerId === declaringPlayerId);
    return mayDeclare ? null : 'NOT_YOUR_TURN';
  }

  if (action.type === 'DROP_TO_IMPULSE') {
    if (!docData.round || docData.round.phase !== 'playing') {
      return 'ROUND_NOT_PLAYING';
    }
    if (!dropToImpulseEnabled(docData)) {
      return 'DROP_TO_IMPULSE_NOT_REQUIRED';
    }

    const declaringPlayerId = action.playerId;
    const isSelf = declaringPlayerId === actorId;
    const isHostProxy =
      !isSelf && canHostProxyAiMove(docData, actorId, declaringPlayerId);
    if (!isSelf && !isHostProxy) {
      return 'NOT_YOUR_TURN';
    }

    if (docData.round.activePlayerId !== declaringPlayerId) {
      return 'NOT_YOUR_TURN';
    }
    if (docData.round.dropToImpulseCallPending !== declaringPlayerId) {
      return 'DROP_TO_IMPULSE_NOT_REQUIRED';
    }
    return null;
  }

  if (action.type === 'CATCH_DROP_TO_IMPULSE') {
    if (!docData.round || docData.round.phase !== 'playing') {
      return 'ROUND_NOT_PLAYING';
    }
    if (!dropToImpulseEnabled(docData)) {
      return 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED';
    }

    const challengerId = action.challengerId;
    const isSelf = challengerId === actorId;
    const isHostProxy =
      !isSelf && canHostProxyAiMove(docData, actorId, challengerId);
    if (!isSelf && !isHostProxy) {
      return 'NOT_YOUR_TURN';
    }

    if (challengerId === action.targetPlayerId) {
      return 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED';
    }
    if (docData.round.dropToImpulseCatchable !== action.targetPlayerId) {
      return 'CATCH_DROP_TO_IMPULSE_NOT_ALLOWED';
    }
    return null;
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
