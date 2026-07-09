import type { GameAction, GameState } from 'warp12-engine';
import {
  FLASH_CATALOG,
  describeFlashEffect,
  getAvailableFlashEffects,
} from 'warp12-engine';

import styles from './flash-panel.module.scss';

interface ContinuumFlashPanelProps {
  game: GameState;
  playerId: string;
  names: Readonly<Record<string, string>>;
  onInvoke: (action: GameAction) => void;
}

export function ContinuumFlashPanel({
  game,
  playerId,
  names,
  onInvoke,
}: ContinuumFlashPanelProps) {
  const round = game.round;
  if (!round || round.continuumPendingInvoker !== playerId) {
    return null;
  }

  const available = new Set(
    getAvailableFlashEffects(round, game.modules, game.captains)
  );
  const entries = FLASH_CATALOG.filter((entry) => available.has(entry.kind));

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <h2 className={styles.title}>Continuum Flash</h2>
        <p className={styles.lead}>
          You charted the double-blank. Choose one reality-bending directive for
          the rest of this round.
        </p>
        <ul className={styles.list}>
          {entries.map((entry) => (
            <ContinuumFlashOption
              key={entry.kind}
              entry={entry}
              onPick={() =>
                onInvoke({
                  type: 'INVOKE_CONTINUUM_FLASH',
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

function ContinuumFlashOption({
  entry,
  onPick,
}: {
  entry: (typeof FLASH_CATALOG)[number];
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

interface ContinuumWagerPanelProps {
  game: GameState;
  playerId: string;
  onResolve: (action: GameAction) => void;
}

export function ContinuumWagerPanel({ game, playerId, onResolve }: ContinuumWagerPanelProps) {
  const pending = game.round?.continuumWagerPending;
  if (!pending || pending.playerId !== playerId) {
    return null;
  }

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.panel}>
        <h2 className={styles.title}>The Continuum Wager</h2>
        <p className={styles.lead}>Keep one coordinate — return the other face-down.</p>
        <div className={styles.gambleRow}>
          {pending.options.map((coordinate, index) => (
            <button
              key={`${coordinate.low}-${coordinate.high}-${index}`}
              type="button"
              className={styles.gambleBtn}
              onClick={() =>
                onResolve({
                  type: 'RESOLVE_CONTINUUM_WAGER',
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

export function ActiveContinuumFlashBanner({
  game,
  names,
  className,
}: {
  game: GameState;
  names: Readonly<Record<string, string>>;
  className?: string;
}) {
  const flash = game.modules.continuum.activeFlash;
  if (!flash || !game.modules.continuum.enabled) {
    return null;
  }

  return (
    <div className={className ?? styles.banner}>
      <dt>Continuum Flash:</dt>
      <dd>{describeFlashEffect(flash.effect, names)}</dd>
    </div>
  );
}

/** Orange Continuum orb — top-right HUD when Module Alpha is in play. */
export function ContinuumOrb({
  game,
  names,
}: {
  game: GameState;
  names: Readonly<Record<string, string>>;
}) {
  if (!game.modules.continuum.enabled || !game.round) {
    return null;
  }

  const flash = game.modules.continuum.activeFlash;
  const pending = game.round.continuumPendingInvoker;
  if (!flash && !pending) {
    return null;
  }

  const label = flash
    ? describeFlashEffect(flash.effect, names)
    : pending
      ? `Continuum flash pending · ${names[pending] ?? pending}`
      : 'Continuum flash active';

  return (
    <div
      className={styles.continuumOrbWrap}
      data-pending={pending && !flash ? 'true' : undefined}
      title={label}
      aria-label={label}
      role="img"
    >
      <span className={styles.continuumOrbAura} aria-hidden />
      <span className={styles.continuumOrbRing} aria-hidden />
      <svg
        className={styles.continuumOrbCore}
        viewBox="0 0 32 32"
        width="32"
        height="32"
        aria-hidden
      >
        <defs>
          <radialGradient id="continuumOrbGradient" cx="35%" cy="30%" r="65%">
            <stop offset="0%" stopColor="#fff7ed" />
            <stop offset="35%" stopColor="#fdba74" />
            <stop offset="70%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#c2410c" />
          </radialGradient>
          <radialGradient id="continuumOrbHighlight" cx="30%" cy="25%" r="40%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="16" cy="16" r="11" fill="url(#continuumOrbGradient)" />
        <circle cx="16" cy="16" r="11" fill="url(#continuumOrbHighlight)" />
        <circle cx="16" cy="16" r="11" fill="none" stroke="#fed7aa" strokeWidth="0.75" opacity="0.6" />
      </svg>
      <span className={styles.continuumOrbLabel}>C</span>
    </div>
  );
}

export function PeekedSectorBanner({
  game,
  viewerId,
  className,
}: {
  game: GameState;
  viewerId: string;
  className?: string;
}) {
  const peek = game.round?.continuumEffects?.peekedSector;
  if (!peek || peek.visibleTo !== viewerId) {
    return null;
  }

  const { low, high } = peek.coordinate;
  return (
    <div className={className ?? styles.peek}>
      <dt>Peek:</dt>
      <dd>
        Top Uncharted tile is {low}-{high}
      </dd>
    </div>
  );
}
