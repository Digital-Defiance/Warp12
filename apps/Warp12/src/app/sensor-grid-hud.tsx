import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { Coordinate } from 'warp12-engine';
import { DominoTile } from 'double-eighteen-react';
import { WARP_PIP_COLORS, WARP_TILE_SURFACE, type WarpTileBg } from 'warp12-theme';

import { FloatingPanelShell } from './floating-panel-shell';
import panelStyles from './sector-status-hud.module.scss';
import holoStyles from './sensor-grid-holo.module.scss';

const STORAGE_KEY = 'warp12-sensor-grid-hud-pos';
const COMPACT_POS_KEY = 'warp12-sensor-grid-holo-pos';
const HINT_SEEN_KEY = 'warp12-sensor-sweep-hint-seen';
const EDGE = 8;

interface StoredPos {
  x: number;
  y: number;
}

function readPos(key: string): StoredPos | null {
  try {
    const raw = localStorage.getItem(key);
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

function writePos(key: string, pos: StoredPos): void {
  try {
    localStorage.setItem(key, JSON.stringify(pos));
  } catch {
    // ignore
  }
}

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function writeHintSeen(): void {
  try {
    localStorage.setItem(HINT_SEEN_KEY, '1');
  } catch {
    // ignore
  }
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

/** Bottom-right, tight to the edge like Fleet Status rail spacing. */
function defaultCompactPos(width: number, height: number): StoredPos {
  const x = Math.max(EDGE, window.innerWidth - width - EDGE);
  const y = Math.max(EDGE, window.innerHeight - height - EDGE);
  return { x, y };
}

export interface SensorGridHudProps {
  containerRef: RefObject<HTMLElement | null>;
  sensorGrid: readonly Coordinate[];
  tileBg: WarpTileBg;
  maxPip: number;
  onSensorSweep?: (coordinate: Coordinate) => void;
  /** Phone layout — hologram strip, no dialog chrome. */
  compact?: boolean;
}

function SensorGridTiles({
  sensorGrid,
  tileBg,
  maxPip,
  onSensorSweep,
  tileWidth,
  tileHeight,
  className,
}: {
  sensorGrid: readonly Coordinate[];
  tileBg: WarpTileBg;
  maxPip: number;
  onSensorSweep?: (coordinate: Coordinate) => void;
  tileWidth: number;
  tileHeight: number;
  className: string;
}) {
  const tileSurface = WARP_TILE_SURFACE[tileBg];
  return (
    <div className={className} role="list" aria-label="Sensor Grid">
      {sensorGrid.map((tile, i) => (
        <button
          key={`${tile.low}-${tile.high}-${i}`}
          type="button"
          className={panelStyles.gridTile}
          role="listitem"
          data-no-holo-drag
          aria-label={`Sensor sweep ${tile.low}:${tile.high}`}
          title={`Sensor sweep: ${tile.low}:${tile.high}`}
          onClick={() => onSensorSweep?.(tile)}
          disabled={!onSensorSweep}
        >
          <DominoTile
            maxPips={maxPip}
            value1={tile.low}
            value2={tile.high}
            width={tileWidth}
            height={tileHeight}
            rotation={0}
            backgroundColor={tileSurface.fill}
            borderColor={tileSurface.border}
            pipColors={WARP_PIP_COLORS}
          />
        </button>
      ))}
    </div>
  );
}

/** Mobile hologram Sensor Grid — no header, not resizable, tight bottom-right. */
function SensorGridHolo({
  sensorGrid,
  tileBg,
  maxPip,
  onSensorSweep,
}: {
  sensorGrid: readonly Coordinate[];
  tileBg: WarpTileBg;
  maxPip: number;
  onSensorSweep?: (coordinate: Coordinate) => void;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<StoredPos | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showHint, setShowHint] = useState(() => !readHintSeen());
  const dragOrigin = useRef<{
    pointerX: number;
    pointerY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) {
      return;
    }
    const place = () => {
      const { offsetWidth: w, offsetHeight: h } = el;
      const stored = readPos(COMPACT_POS_KEY);
      setPos(
        stored ? clampPos(stored.x, stored.y, w, h) : defaultCompactPos(w, h)
      );
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
  }, [sensorGrid.length, showHint]);

  const markHintSeen = useCallback(() => {
    if (!showHint) {
      return;
    }
    writeHintSeen();
    setShowHint(false);
  }, [showHint]);

  const handleSweep = useCallback(
    (coordinate: Coordinate) => {
      markHintSeen();
      onSensorSweep?.(coordinate);
    },
    [markHintSeen, onSensorSweep]
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) {
        return;
      }
      if ((event.target as Element).closest('[data-no-holo-drag]')) {
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
    },
    [pos]
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const origin = dragOrigin.current;
      const el = rootRef.current;
      if (!origin || !el) {
        return;
      }
      setPos(
        clampPos(
          origin.originX + (event.clientX - origin.pointerX),
          origin.originY + (event.clientY - origin.pointerY),
          el.offsetWidth,
          el.offsetHeight
        )
      );
    },
    []
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
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
        writePos(COMPACT_POS_KEY, next);
        try {
          el.releasePointerCapture(event.pointerId);
        } catch {
          // already released
        }
      }
      dragOrigin.current = null;
      setDragging(false);
    },
    []
  );

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      ref={rootRef}
      className={holoStyles.holo}
      role="region"
      aria-label="Sensor Grid. Drag empty space to reposition."
      tabIndex={0}
      data-dragging={dragging ? 'true' : undefined}
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : {
              right: EDGE,
              bottom: EDGE,
              left: 'auto',
              top: 'auto',
              visibility: 'hidden' as const,
            }
      }
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className={holoStyles.scan} aria-hidden />
      <div className={holoStyles.body}>
        {showHint && (
          <p className={holoStyles.hint}>
            {onSensorSweep
              ? 'Tap to sweep into hand'
              : 'Sweep on your turn'}
          </p>
        )}
        <SensorGridTiles
          sensorGrid={sensorGrid}
          tileBg={tileBg}
          maxPip={maxPip}
          onSensorSweep={onSensorSweep ? handleSweep : undefined}
          tileWidth={18}
          tileHeight={36}
          className={holoStyles.tiles}
        />
      </div>
    </div>,
    document.body
  );
}

/** Face-up Module Gamma market — desktop panel, or mobile hologram strip. */
export function SensorGridHud({
  containerRef,
  sensorGrid,
  tileBg,
  maxPip,
  onSensorSweep,
  compact = false,
}: SensorGridHudProps) {
  if (sensorGrid.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <SensorGridHolo
        sensorGrid={sensorGrid}
        tileBg={tileBg}
        maxPip={maxPip}
        onSensorSweep={onSensorSweep}
      />
    );
  }

  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={STORAGE_KEY}
      defaultAnchor="top-right"
      panelClassName={panelStyles.belowQOrb}
      title="Sensor Grid"
      width={260}
      accent="cyan"
    >
      <div className={panelStyles.sensorOnlyBody}>
        <p className={panelStyles.sensorOnlyHint}>
          {onSensorSweep
            ? 'Tap a coordinate to sweep it into your hand.'
            : 'Long-range sensor market — sweep on your turn.'}
        </p>
        <SensorGridTiles
          sensorGrid={sensorGrid}
          tileBg={tileBg}
          maxPip={maxPip}
          onSensorSweep={onSensorSweep}
          tileWidth={20}
          tileHeight={40}
          className={panelStyles.gridTiles}
        />
      </div>
    </FloatingPanelShell>
  );
}
