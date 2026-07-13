import {
  GAME_SOUND_PREVIEW_LABELS,
  PREVIEWABLE_GAME_SOUNDS,
  previewGameSound,
  previewTurnBeep,
  unlockGameAudio,
} from '../game/game-sounds.js';
import { getWarp12SynthEngine } from '../game/warp12-synth-engine.js';
import styles from './game-sound-preview-panel.module.scss';

function previewAllStopWithBridgeAmbience(): void {
  unlockGameAudio();
  getWarp12SynthEngine().startAmbience();
  previewGameSound('allStop');
}

export function GameSoundPreviewPanel() {
  return (
    <details className={styles.panel}>
      <summary className={styles.summary}>Sound lab</summary>
      <div className={styles.body}>
        <p className={styles.hint}>
          Preview procedural table sounds without starting a mission. Works even
          when bridge audio is muted. Dev console:{' '}
          <code>warp12.previewSound(&apos;allStop&apos;)</code>
        </p>
        <div className={styles.grid}>
          {PREVIEWABLE_GAME_SOUNDS.map((sound) => (
            <button
              key={sound}
              type="button"
              className={styles.button}
              onClick={() => previewGameSound(sound)}
            >
              {GAME_SOUND_PREVIEW_LABELS[sound]}
            </button>
          ))}
          <button
            type="button"
            className={styles.button}
            onClick={() => previewAllStopWithBridgeAmbience()}
          >
            All Stop + bridge ambience fade
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => {
              unlockGameAudio();
              getWarp12SynthEngine().startAmbience();
            }}
          >
            Bridge ambience only
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={() => previewTurnBeep(12)}
          >
            Chart chirp (slot 12)
          </button>
        </div>
      </div>
    </details>
  );
}
