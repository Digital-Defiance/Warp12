/**
 * Firestore persistence for captain-named game-setup presets.
 *
 * Presets live on the owner's `playerProfiles/{uid}` document under a
 * `setupPresets` array field. Security rules already allow an owner to
 * create/update their profile as long as `uid` matches, so no rules change is
 * required beyond keeping that field owner-writable. Anonymous captains fall
 * back to localStorage (see `setup-presets.ts` / `use-setup-presets`).
 */
import { doc, getDoc, setDoc } from 'firebase/firestore';

import {
  sanitizeNamedPresetList,
  type NamedSetupPreset,
} from '../game/setup-presets.js';
import { getFirestoreDb, isFirebaseConfigured } from './config.js';

const PLAYER_PROFILES = 'playerProfiles';

/** Read the signed-in captain's saved presets, or `[]` when none/unavailable. */
export async function fetchSetupPresets(
  uid: string
): Promise<NamedSetupPreset[]> {
  if (!isFirebaseConfigured()) {
    return [];
  }
  const db = getFirestoreDb();
  if (!db) {
    return [];
  }
  const snap = await getDoc(doc(db, PLAYER_PROFILES, uid));
  if (!snap.exists()) {
    return [];
  }
  const data = snap.data() as { setupPresets?: unknown };
  return sanitizeNamedPresetList(data.setupPresets);
}

/**
 * Overwrite the captain's preset list. Kept as a whole-array write (merged onto
 * the profile doc) — presets are few, single-user, and low-contention.
 */
export async function persistSetupPresets(
  uid: string,
  presets: readonly NamedSetupPreset[]
): Promise<void> {
  if (!isFirebaseConfigured()) {
    return;
  }
  const db = getFirestoreDb();
  if (!db) {
    return;
  }
  await setDoc(
    doc(db, PLAYER_PROFILES, uid),
    {
      uid,
      setupPresets: presets,
      setupPresetsUpdatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}
