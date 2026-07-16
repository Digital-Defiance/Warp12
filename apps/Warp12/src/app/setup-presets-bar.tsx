import { useState } from 'react';

import { useAnnounce } from '../a11y/live-announcer';
import {
  type GameSetupType,
  type WarpSetupPreset,
} from '../game/setup-presets.js';
import { useSetupPresets } from './use-setup-presets';
import styles from './lobby.module.scss';

interface SetupPresetsBarProps {
  /** Which surface this bar lives on — stamped on newly-saved presets. */
  setupType: GameSetupType;
  /** Read the current form as a portable preset (evaluated lazily on save). */
  getCurrentPreset: () => WarpSetupPreset;
  /** Apply a chosen preset back onto the form. */
  onApply: (preset: WarpSetupPreset) => void;
  disabled?: boolean;
}

/**
 * Load / save / delete named setup presets. Works on all three setup surfaces
 * via the canonical {@link WarpSetupPreset} model; storage transparently uses
 * Firestore for signed-in accounts and localStorage otherwise.
 */
export function SetupPresetsBar({
  setupType,
  getCurrentPreset,
  onApply,
  disabled = false,
}: SetupPresetsBarProps) {
  const { presets, ready, storage, savePreset, deletePreset } =
    useSetupPresets();
  const announce = useAnnounce();
  const [selectedId, setSelectedId] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const controlsDisabled = disabled || !ready || busy;
  const selected = presets.find((row) => row.id === selectedId) ?? null;

  const handleLoad = (id: string) => {
    setSelectedId(id);
    const match = presets.find((row) => row.id === id);
    if (!match) {
      return;
    }
    onApply(match.preset);
    if (!name.trim()) {
      setName(match.name);
    }
    announce(`Loaded setup preset ${match.name}.`);
  };

  const handleSave = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    setBusy(true);
    try {
      await savePreset({
        name: trimmed,
        preset: getCurrentPreset(),
        sourceType: setupType,
      });
      announce(
        `Saved setup preset ${trimmed} ${
          storage === 'cloud' ? 'to your account' : 'on this device'
        }.`
      );
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) {
      return;
    }
    const removed = selected.name;
    setBusy(true);
    try {
      await deletePreset(selected.id);
      setSelectedId('');
      announce(`Deleted setup preset ${removed}.`);
    } finally {
      setBusy(false);
    }
  };

  const storageHint =
    storage === 'cloud'
      ? 'Synced to your account — available on any device you sign in on.'
      : 'Saved on this device. Sign in to sync presets across devices.';

  return (
    <fieldset className={styles.fieldset}>
      <legend>Saved setups</legend>

      {presets.length > 0 ? (
        <div className={styles.presetRow}>
          <select
            className={styles.presetSelect}
            aria-label="Load a saved setup"
            value={selectedId}
            disabled={controlsDisabled}
            onChange={(e) => handleLoad(e.target.value)}
          >
            <option value="">Load a saved setup…</option>
            {presets.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={styles.presetDelete}
            disabled={controlsDisabled || !selected}
            onClick={() => void handleDelete()}
          >
            Delete
          </button>
        </div>
      ) : (
        <p className={styles.hint}>
          No saved setups yet — configure the sector below and save it for reuse
          across Local, Pass &amp; Play, and Online.
        </p>
      )}

      <div className={styles.presetRow}>
        <input
          type="text"
          className={styles.presetInput}
          aria-label="Preset name"
          placeholder="Name this setup"
          maxLength={60}
          value={name}
          disabled={controlsDisabled}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          type="button"
          className={styles.presetSave}
          disabled={controlsDisabled || !name.trim()}
          onClick={() => void handleSave()}
        >
          {selected && selected.name.toLowerCase() === name.trim().toLowerCase()
            ? 'Update'
            : 'Save'}
        </button>
      </div>

      <p className={styles.presetHint}>{storageHint}</p>
    </fieldset>
  );
}
