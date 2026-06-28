import type { PlacedCoordinate, RoundState } from 'warp12-engine';
import { DoubleTwelve } from 'doubletwelve';
import type { RefObject } from 'react';
import { useMemo } from 'react';

import type { TrailAccessState, TrailSpokeStatus } from 'warp12-react';
import { WARP_PIP_COLORS, WARP_TILE_SURFACE, type WarpTileBg } from 'warp12-theme';
import { FloatingPanelShell } from './floating-panel-shell';
import type { CaptainTailsDisplay } from './table-view-prefs';
import styles from './captain-tails-hud.module.scss';

const STORAGE_KEY = 'warp12-captain-tails-hud-pos';

export interface TailRow {
  readonly rowId: string;
  readonly label: string;
  readonly connectValue: number;
  readonly lastTile: PlacedCoordinate | null;
  readonly state: TrailAccessState;
  readonly isActive: boolean;
}

export interface CaptainTailsHudProps {
  containerRef: RefObject<HTMLElement | null>;
  round: RoundState;
  trailSpokes: readonly TrailSpokeStatus[];
  activePlayerId: string;
  display: CaptainTailsDisplay;
  tileBg: WarpTileBg;
}

export function buildTailRows(
  round: RoundState,
  trailSpokes: readonly TrailSpokeStatus[],
  activePlayerId: string
): TailRow[] {
  const spokeByCaptain = new Map(
    trailSpokes
      .filter((spoke): spoke is TrailSpokeStatus & { captainId: string } =>
        Boolean(spoke.captainId)
      )
      .map((spoke) => [spoke.captainId, spoke])
  );

  const captainRows = round.turnOrder.map((captainId) => {
    const spoke = spokeByCaptain.get(captainId);
    const trail = round.table.warpTrails[captainId];
    const lastTile =
      trail && trail.tiles.length > 0
        ? trail.tiles[trail.tiles.length - 1]
        : null;

    return {
      rowId: captainId,
      label: spoke?.label ?? captainId,
      connectValue: spoke?.connectValue ?? round.spacedockValue,
      lastTile,
      state: spoke?.state ?? 'shields',
      isActive: captainId === activePlayerId,
    };
  });

  const neutralSpoke = trailSpokes.find((spoke) => spoke.state === 'neutral');
  const neutralTiles = round.table.neutralZone.tiles;
  const neutralLastTile =
    neutralTiles.length > 0
      ? neutralTiles[neutralTiles.length - 1]
      : null;

  return [
    ...captainRows,
    {
      rowId: 'neutral-zone',
      label: 'Neutral zone',
      connectValue: neutralSpoke?.connectValue ?? round.spacedockValue,
      lastTile: neutralLastTile,
      state: 'neutral' as const,
      isActive: false,
    },
  ];
}

/** @deprecated Use {@link buildTailRows}. */
export function buildCaptainTailRows(
  round: RoundState,
  trailSpokes: readonly TrailSpokeStatus[],
  activePlayerId: string
): TailRow[] {
  return buildTailRows(round, trailSpokes, activePlayerId).filter(
    (row) => row.rowId !== 'neutral-zone'
  );
}

export function formatTailCoordinate(
  lastTile: PlacedCoordinate | null,
  spacedockValue: number
): string {
  if (lastTile) {
    const { low, high } = lastTile.coordinate;
    return `${low}:${high}`;
  }
  return `${spacedockValue}:${spacedockValue}`;
}

export function tailTileDisplayValues(last: PlacedCoordinate): {
  top: number;
  bottom: number;
} {
  const { coordinate, openValue } = last;
  const closedEnd =
    coordinate.low === openValue ? coordinate.high : coordinate.low;
  return { top: closedEnd, bottom: openValue };
}

function TailReadout({
  row,
  display,
  tileBg,
}: {
  row: TailRow;
  display: CaptainTailsDisplay;
  tileBg: WarpTileBg;
}) {
  const tileSurface = WARP_TILE_SURFACE[tileBg];
  const coordinateLabel = formatTailCoordinate(row.lastTile, row.connectValue);

  if (display === 'domino' && row.lastTile) {
    const { top, bottom } = tailTileDisplayValues(row.lastTile);
    return (
      <span className={styles.tailReadout}>
        <span className={styles.dominoWrap} aria-hidden>
          <DoubleTwelve
            value1={top}
            value2={bottom}
            width={22}
            height={44}
            backgroundColor={tileSurface.fill}
            borderColor={tileSurface.border}
            pipColors={WARP_PIP_COLORS}
          />
        </span>
        <span className={styles.coordinate}>{coordinateLabel}</span>
      </span>
    );
  }

  return (
    <span
      className={styles.coordinate}
      title={
        row.lastTile
          ? `Tail ${coordinateLabel} · open ${row.connectValue}`
          : `Spacedock ${coordinateLabel} · open ${row.connectValue}`
      }
    >
      {coordinateLabel}
    </span>
  );
}

export function CaptainTailsHud({
  containerRef,
  round,
  trailSpokes,
  activePlayerId,
  display,
  tileBg,
}: CaptainTailsHudProps) {
  const rows = useMemo(
    () => buildTailRows(round, trailSpokes, activePlayerId),
    [activePlayerId, round, trailSpokes]
  );

  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={STORAGE_KEY}
      defaultAnchor="bottom-right"
      title="Tails"
      width={260}
      accent="cyan"
    >
      <ul className={styles.list} aria-label="Trail tails">
        {rows.map((row) => (
          <li
            key={row.rowId}
            className={styles.row}
            data-active={row.isActive ? 'true' : undefined}
            data-state={row.state}
          >
            <span className={styles.name}>{row.label}</span>
            <TailReadout row={row} display={display} tileBg={tileBg} />
          </li>
        ))}
      </ul>
      <p className={styles.hint}>
        {display === 'domino'
          ? 'Mini tile plus coordinate · empty lines show the spacedock double.'
          : 'Tail coordinate for each warp trail and Neutral zone (e.g. 6:12, 6:6).'}
      </p>
    </FloatingPanelShell>
  );
}
