/**
 * Shadow-mute fanout: accept the write, then hide from other captains.
 * Ops-set only — detectors never apply shadow mutes automatically.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';

import { isSectorShadowMuted, isUidShadowMuted } from '../ops/mutes';

export const onMessageShadowMute = onDocumentCreated(
  'games/{gameId}/messages/{messageId}',
  async (event) => {
    const message = event.data?.data();
    if (!message || typeof message.from !== 'string') {
      return;
    }
    if (message.shadowHidden === true) {
      return;
    }
    const gameId = event.params.gameId;
    const uid = message.from;
    const shadowed =
      (await isUidShadowMuted(uid)) ||
      (await isSectorShadowMuted(gameId, uid));
    if (!shadowed) {
      return;
    }
    await event.data!.ref.update({
      shadowHidden: true,
      // Drop out of spectator `audience == 'table'` queries without breaking
      // member list listeners (those stay query-compatible in rules).
      audience: 'shadow',
      shadowHiddenAt: FieldValue.serverTimestamp(),
    });
  }
);
