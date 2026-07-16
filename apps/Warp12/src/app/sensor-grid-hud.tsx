import type { Coordinate } from 'warp12-engine';
import type { RefObject } from 'react';
import { DominoTile } from 'double-eighteen-react';
import { WARP_PIP_COLORS, WARP_TILE_SURFACE, type WarpTileBg } from 'warp12-theme';

import { FloatingPanelShell } from './floating-panel-shell';
import styles from './sector-status-hud.module.scss';

const STORAGE_KEY = 'warp12-sensor-grid-hud-pos';

export interface SensorGridHudProps {
  containerRef: RefObject<HTMLElement | null>;
  sensorGrid: readonly Coordinate[];
  tileBg: WarpTileBg;
  maxPip: number;
  onSensorSweep?: (coordinate: Coordinate) => void;
  compact?: boolean;
}

/** Face-up Module Gamma market when Sector Status is hidden — sweeps still need a target. */
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

  const tileSurface = WARP_TILE_SURFACE[tileBg];

  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={compact ? `${STORAGE_KEY}:compact` : STORAGE_KEY}
      defaultAnchor="top-right"
      panelClassName={`${styles.belowQOrb}${compact ? ` ${styles.compact}` : ''}`}
      title="Sensor Grid"
      width={compact ? 220 : 260}
      accent="cyan"
    >
      <div className={styles.sensorOnlyBody}>
        <p className={styles.sensorOnlyHint}>
          {onSensorSweep
            ? 'Tap a coordinate to sweep it into your hand.'
            : 'Long-range sensor market — sweep on your turn.'}
        </p>
        <div className={styles.gridTiles} role="list" aria-label="Sensor Grid">
          {sensorGrid.map((tile, i) => (
            <button
              key={`${tile.low}-${tile.high}-${i}`}
              type="button"
              className={styles.gridTile}
              role="listitem"
              aria-label={`Sensor sweep ${tile.low}:${tile.high}`}
              title={`Sensor sweep: ${tile.low}:${tile.high}`}
              onClick={() => onSensorSweep?.(tile)}
              disabled={!onSensorSweep}
            >
              <DominoTile
                maxPips={maxPip}
                value1={tile.low}
                value2={tile.high}
                width={20}
                height={40}
                rotation={0}
                backgroundColor={tileSurface.fill}
                borderColor={tileSurface.border}
                pipColors={WARP_PIP_COLORS}
              />
            </button>
          ))}
        </div>
      </div>
    </FloatingPanelShell>
  );
}
