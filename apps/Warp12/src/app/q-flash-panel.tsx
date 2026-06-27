import type { GameAction, GameState } from '@warp12/Warp12-lib';
import {
  Q_FLASH_CATALOG,
  describeQFlashEffect,
  getAvailableQFlashEffects,
} from '@warp12/Warp12-lib';

import styles from './q-flash-panel.module.scss';

interface QFlashPanelProps {
  game: GameState;
  playerId: string;
  names: Readonly<Record<string, string>>;
  onInvoke: (action: GameAction) => void;
}

export function QFlashPanel({
  game,
  playerId,
  names,
  onInvoke,
}: QFlashPanelProps) {
  const round = game.round;
  if (!round || round.qPendingInvoker !== playerId) {
    return null;
  }

  const available = new Set(
    getAvailableQFlashEffects(round, game.modules, game.captains)
  );
  const entries = Q_FLASH_CATALOG.filter((entry) => available.has(entry.kind));

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <h2 className={styles.title}>Q-Flash</h2>
        <p className={styles.lead}>
          You charted the double-blank. Choose one reality-bending directive for
          the rest of this round.
        </p>
        <ul className={styles.list}>
          {entries.map((entry) => (
            <QFlashOption
              key={entry.kind}
              entry={entry}
              onPick={() =>
                onInvoke({
                  type: 'INVOKE_Q_FLASH',
                  playerId,
                  effect: entry.kind,
                })
              }
            />
          ))}
        </ul>
      </div>
    </div>
  );
}

function QFlashOption({
  entry,
  onPick,
}: {
  entry: (typeof Q_FLASH_CATALOG)[number];
  onPick: () => void;
}) {
  return (
    <li>
      <button type="button" className={styles.option} onClick={onPick}>
        <span className={styles.optionLabel}>{entry.label}</span>
        <span className={styles.optionDetail}>{entry.description}</span>
      </button>
    </li>
  );
}

interface QGamblePanelProps {
  game: GameState;
  playerId: string;
  onResolve: (action: GameAction) => void;
}

export function QGamblePanel({ game, playerId, onResolve }: QGamblePanelProps) {
  const pending = game.round?.qGamblePending;
  if (!pending || pending.playerId !== playerId) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <h2 className={styles.title}>Q&apos;s gamble</h2>
        <p className={styles.lead}>Keep one coordinate — return the other face-down.</p>
        <div className={styles.gambleRow}>
          {pending.options.map((coordinate, index) => (
            <button
              key={`${coordinate.low}-${coordinate.high}-${index}`}
              type="button"
              className={styles.gambleBtn}
              onClick={() =>
                onResolve({
                  type: 'RESOLVE_Q_GAMBLE',
                  playerId,
                  keepIndex: index as 0 | 1,
                })
              }
            >
              Keep {coordinate.low}-{coordinate.high}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ActiveQFlashBanner({
  game,
  names,
}: {
  game: GameState;
  names: Readonly<Record<string, string>>;
}) {
  const flash = game.modules.qContinuum.activeFlash;
  if (!flash || !game.modules.qContinuum.enabled) {
    return null;
  }

  return (
    <div className={styles.banner}>
      <dt>Q-Flash:</dt>
      <dd>{describeQFlashEffect(flash.effect, names)}</dd>
    </div>
  );
}

/** Orange energy orb — top-right HUD when Q-Continuum is in play. */
export function QActiveOrb({
  game,
  names,
}: {
  game: GameState;
  names: Readonly<Record<string, string>>;
}) {
  if (!game.modules.qContinuum.enabled || !game.round) {
    return null;
  }

  const flash = game.modules.qContinuum.activeFlash;
  const pending = game.round.qPendingInvoker;
  if (!flash && !pending) {
    return null;
  }

  const label = flash
    ? describeQFlashEffect(flash.effect, names)
    : pending
      ? `Q-Flash pending · ${names[pending] ?? pending}`
      : 'Q-Flash active';

  return (
    <div
      className={styles.qOrbWrap}
      data-pending={pending && !flash ? 'true' : undefined}
      title={label}
      aria-label={label}
      role="img"
    >
      <span className={styles.qOrbAura} aria-hidden />
      <span className={styles.qOrbRing} aria-hidden />
      <svg
        className={styles.qOrbCore}
        viewBox="0 0 32 32"
        width="32"
        height="32"
        aria-hidden
      >
        <defs>
          <radialGradient id="qOrbGradient" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="35%" stopColor="#fdba74" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <radialGradient id="qOrbHighlight" cx="30%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="11" fill="url(#qOrbGradient)" />
        <circle cx="16" cy="16" r="11" fill="url(#qOrbHighlight)" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="#fed7aa" strokeWidth="0.75" opacity="0.6" />
      </svg>
      <span className={styles.qOrbLabel}>Q</span>
    </div>
  );
}

export function PeekedSectorBanner({
  game,
  viewerId,
}: {
  game: GameState;
  viewerId: string;
}) {
  const peek = game.round?.qEffects?.peekedSector;
  if (!peek || peek.visibleTo !== viewerId) {
    return null;
  }

  const { low, high } = peek.coordinate;
  return (
    <div className={styles.peek}>
      <dt>Peek:</dt>
      <dd>
        Top Uncharted tile is {low}-{high}
      </dd>
    </div>
  );
}
