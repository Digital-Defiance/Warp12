import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import {
  formatCampaignRoundProgress,
  type GameState,
  type RoundState,
} from 'warp12-engine';

import {
  formatSectorTurnFooter,
  shouldShowAiThinking,
} from './sector-status-hud';
import styles from './sector-status-holo.module.scss';

const STORAGE_KEY = 'warp12-sector-holo-pos';
const EDGE = 10;

interface StoredPos {
  x: number;
  y: number;
}

function readPos(): StoredPos | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as StoredPos;
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') {
      return parsed;
    }
  } catch {
    // ignore
  }
  return null;
}

function writePos(pos: StoredPos): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function defaultPos(width: number, _height: number): StoredPos {
  // Top-right, under status / Continuum orb area.
  const x = Math.max(EDGE, window.innerWidth - width - EDGE);
  const y = EDGE + 48;
  return { x, y };
}

function clampPos(
  x: number,
  y: number,
  width: number,
  height: number
): StoredPos {
  const maxX = Math.max(EDGE, window.innerWidth - width - EDGE);
  const maxY = Math.max(EDGE, window.innerHeight - height - EDGE);
  return {
    x: Math.min(maxX, Math.max(EDGE, x)),
    y: Math.min(maxY, Math.max(EDGE, y)),
  };
}

export interface SectorStatusHoloProps {
  containerRef: RefObject<HTMLElement | null>;
  game: GameState;
  round: RoundState | null | undefined;
  names: Readonly<Record<string, string>>;
  activePlayerId: string;
  handOwnerId: string;
  isMyTurn: boolean;
  activePlayerIsAi: boolean;
  isOnline: boolean;
  isOnlineHost: boolean;
  syncPending: boolean;
  roundAwaitingScore: boolean;
  roundEndSummaryOpen: boolean;
  lastMessage: string | null;
  spacedockValue: number;
  unchartedCount: number;
  beaconCount: number;
  openTrailNames: readonly string[];
  redAlertActive: boolean;
  redAlertLabel: string;
  redAlertSummary: string;
  redAlertTone: 'yellow' | 'alert';
  longestTrailCaptains?: readonly string[];
  longestTrailLength?: number;
  hazardMarkerHolder?: string | null;
}

/**
 * Mobile-only Sector Status hologram — translucent projection over the table,
 * drag to reposition. Not a floating dialog shell. Sensor Grid stays separate.
 */
export function SectorStatusHolo({
  containerRef: _containerRef,
  game,
  round,
  names,
  activePlayerId,
  handOwnerId,
  isMyTurn,
  activePlayerIsAi,
  isOnline,
  isOnlineHost,
  syncPending,
  roundAwaitingScore,
  roundEndSummaryOpen,
  lastMessage,
  spacedockValue,
  unchartedCount,
  beaconCount,
  openTrailNames,
  redAlertActive,
  redAlertLabel,
  redAlertSummary,
  redAlertTone,
  longestTrailCaptains = [],
  longestTrailLength = 0,
  hazardMarkerHolder = null,
}: SectorStatusHoloProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<StoredPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const showAiThinking = shouldShowAiThinking({
    activePlayerIsAi,
    isOnline,
    isOnlineHost,
  });
  const turnFooter = formatSectorTurnFooter({
    game,
    round,
    names,
    activePlayerId,
    handOwnerId,
    isMyTurn,
    activePlayerIsAi,
    isOnline,
    isOnlineHost,
    syncPending,
    roundAwaitingScore,
    roundEndSummaryOpen,
    lastMessage,
  });

  const roundLabel = round
    ? game.objective === 'points'
      ? formatCampaignRoundProgress(round.roundNumber, game.campaignRounds)
      : `R${round.roundNumber}`
    : '—';

  const longestLabel =
    game.modules.longestTrail?.enabled && longestTrailLength > 0
      ? longestTrailCaptains.length === 1
        ? `${names[longestTrailCaptains[0]] ?? '?'} ${longestTrailLength}`
        : longestTrailCaptains.length > 1
          ? `Tied ${longestTrailLength}`
          : null
      : null;

  // Place once measured (or restore).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const place = () => {
      const { offsetWidth: w, offsetHeight: h } = el;
      const stored = readPos();
      const next = stored
        ? clampPos(stored.x, stored.y, w, h)
        : defaultPos(w, h);
      setPos(next);
    };
    place();
    const onResize = () => {
      setPos((current) => {
        if (!current || !rootRef.current) {
          return current;
        }
        return clampPos(
          current.x,
          current.y,
          rootRef.current.offsetWidth,
          rootRef.current.offsetHeight
        );
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    const el = rootRef.current;
    if (!el || !pos) {
      return;
    }
    el.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      originX: pos.x,
      originY: pos.y,
    };
    setDragging(true);
  }, [pos]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = dragOrigin.current;
    const el = rootRef.current;
    if (!origin || !el) {
      return;
    }
    const next = clampPos(
      origin.originX + (event.clientX - origin.pointerX),
      origin.originY + (event.clientY - origin.pointerY),
      el.offsetWidth,
      el.offsetHeight
    );
    setPos(next);
  }, []);

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragOrigin.current && rootRef.current) {
      const el = rootRef.current;
      const origin = dragOrigin.current;
      const next = clampPos(
        origin.originX + (event.clientX - origin.pointerX),
        origin.originY + (event.clientY - origin.pointerY),
        el.offsetWidth,
        el.offsetHeight
      );
      setPos(next);
      writePos(next);
      try {
        el.releasePointerCapture(event.pointerId);
      } catch {
        // already released
      }
    }
    dragOrigin.current = null;
    setDragging(false);
  }, []);

  const node = (
    <div
      ref={rootRef}
      className={styles.holo}
      role="status"
      aria-label="Sector status hologram. Drag to reposition."
      tabIndex={0}
      data-dragging={dragging ? 'true' : undefined}
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : { left: EDGE, top: EDGE + 48, visibility: 'hidden' as const }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={styles.scan} aria-hidden />
      <div className={styles.body}>
        <p className={styles.line}>
          <span className={styles.k}>Rnd</span> {roundLabel}
          <span className={styles.sep} aria-hidden>
            ·
          </span>
          <span className={styles.k}>Dock</span> {spacedockValue}
        </p>
        <p className={styles.line}>
          <span className={styles.k}>Helm</span> {names[activePlayerId] ?? '—'}
          <span className={styles.sep} aria-hidden>
            ·
          </span>
          <span className={styles.k}>U</span> {unchartedCount}
        </p>
        {(beaconCount > 0 || openTrailNames.length > 0) && (
          <p className={styles.line}>
            <span className={styles.k}>Beacons</span> {beaconCount}
            {openTrailNames.length > 0 ? ` · ${openTrailNames.join(', ')}` : ''}
          </p>
        )}
        {redAlertActive && (
          <p
            className={styles.line}
            data-tone={redAlertTone === 'yellow' ? 'yellow' : 'alert'}
          >
            <span className={styles.k}>{redAlertLabel}</span> {redAlertSummary}
          </p>
        )}
        {longestLabel && (
          <p className={styles.line}>
            <span className={styles.k}>Long</span> {longestLabel}
          </p>
        )}
        {game.modules.warpDriveSpool?.enabled && hazardMarkerHolder && (
          <p className={styles.line} data-tone="yellow">
            <span className={styles.k}>Hazard</span>{' '}
            {names[hazardMarkerHolder] ?? '—'}
          </p>
        )}
        {game.modules.temporalInversion?.enabled &&
          round &&
          round.roundNumber % 2 === 0 && (
            <p className={styles.line} data-tone="alert">
              <span className={styles.k}>Invert</span> highest hand wins
            </p>
          )}
        <p
          className={styles.footer}
          data-my-turn={isMyTurn ? 'true' : undefined}
          data-ai={showAiThinking ? 'true' : undefined}
        >
          {turnFooter}
        </p>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return null;
  }
  return createPortal(node, document.body);
}
