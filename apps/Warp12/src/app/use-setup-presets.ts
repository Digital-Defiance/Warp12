import { useCallback, useEffect, useState } from 'react';

import { isVerifiedUser } from '../firebase/auth-actions.js';
import {
  fetchSetupPresets,
  persistSetupPresets,
} from '../firebase/setup-preset-service.js';
import { useFirebaseAuth } from '../firebase/index.js';
import {
  newPresetId,
  readLocalNamedPresets,
  writeLocalNamedPresets,
  type GameSetupType,
  type NamedSetupPreset,
  type WarpSetupPreset,
} from '../game/setup-presets.js';

export type SetupPresetStorage = 'cloud' | 'local';

export interface SavePresetInput {
  name: string;
  preset: WarpSetupPreset;
  sourceType: GameSetupType;
}

export interface UseSetupPresets {
  presets: NamedSetupPreset[];
  ready: boolean;
  /** Where presets persist: signed-in accounts sync to Firestore. */
  storage: SetupPresetStorage;
  savePreset: (input: SavePresetInput) => Promise<void>;
  deletePreset: (id: string) => Promise<void>;
}

/**
 * Named setup presets with automatic backing-store selection: a verified
 * (non-anonymous) captain syncs to Firestore for cross-device use; everyone
 * else persists to localStorage. Saving by an existing name updates that entry.
 */
export function useSetupPresets(): UseSetupPresets {
  const auth = useFirebaseAuth();
  const cloud = auth.configured && isVerifiedUser(auth.user);
  const uid = auth.user?.uid;
  const storage: SetupPresetStorage = cloud ? 'cloud' : 'local';

  const [presets, setPresets] = useState<NamedSetupPreset[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    setReady(false);
    if (cloud && uid) {
      fetchSetupPresets(uid)
        .then((rows) => {
          if (active) {
            setPresets(rows);
            setReady(true);
          }
        })
        .catch(() => {
          if (active) {
            // Fall back to whatever is cached locally if the cloud read fails.
            setPresets(readLocalNamedPresets());
            setReady(true);
          }
        });
    } else {
      setPresets(readLocalNamedPresets());
      setReady(true);
    }
    return () => {
      active = false;
    };
  }, [cloud, uid]);

  const persist = useCallback(
    async (next: NamedSetupPreset[]) => {
      setPresets(next);
      if (cloud && uid) {
        await persistSetupPresets(uid, next);
      } else {
        writeLocalNamedPresets(next);
      }
    },
    [cloud, uid]
  );

  const savePreset = useCallback(
    async ({ name, preset, sourceType }: SavePresetInput) => {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) {
        return;
      }
      const now = new Date().toISOString();
      const existing = presets.find(
        (row) => row.name.toLowerCase() === trimmed.toLowerCase()
      );
      const entry: NamedSetupPreset = existing
        ? { ...existing, name: trimmed, sourceType, preset, updatedAt: now }
        : {
            id: newPresetId(),
            name: trimmed,
            sourceType,
            createdAt: now,
            updatedAt: now,
            preset,
          };
      const next = existing
        ? presets.map((row) => (row.id === existing.id ? entry : row))
        : [...presets, entry];
      next.sort((a, b) => a.name.localeCompare(b.name));
      await persist(next);
    },
    [persist, presets]
  );

  const deletePreset = useCallback(
    async (id: string) => {
      await persist(presets.filter((row) => row.id !== id));
    },
    [persist, presets]
  );

  return { presets, ready, storage, savePreset, deletePreset };
}
