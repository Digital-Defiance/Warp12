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
  readonly tacticalClassAbbrev?: string;
  readonly tacticalClassLabel?: string;
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
  tacticalClassAbbrevByCaptain?: Readonly<Record<string, string>>;
  tacticalClassLabelByCaptain?: Readonly<Record<string, string>>;
}

export function buildTailRows(
  round: RoundState,
  trailSpokes: readonly TrailSpokeStatus[],
  activePlayerId: string,
  tacticalClassAbbrevByCaptain: Readonly<Record<string, string>> = {},
  tacticalClassLabelByCaptain: Readonly<Record<string, string>> = {}
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
      ...(tacticalClassAbbrevByCaptain[captainId]
        ? {
            tacticalClassAbbrev: tacticalClassAbbrevByCaptain[captainId],
            tacticalClassLabel: tacticalClassLabelByCaptain[captainId],
          }
        : {}),
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

export function buildCaptainTailRows(
  round: RoundState,
  trailSpokes: readonly TrailSpokeStatus[],
  activePlayerId: string,
  tacticalClassAbbrevByCaptain?: Readonly<Record<string, string>>,
  tacticalClassLabelByCaptain?: Readonly<Record<string, string>>
): TailRow[] {
  return buildTailRows(
    round,
    trailSpokes,
    activePlayerId,
    tacticalClassAbbrevByCaptain,
    tacticalClassLabelByCaptain
  ).filter((row) => row.rowId !== 'neutral-zone');
}

export function resolveTailEnds(
  lastTile: PlacedCoordinate | null,
  spacedockValue: number
): { anchor: number; tail: number } {
  if (lastTile) {
    const { coordinate, openValue } = lastTile;
    const anchor =
      coordinate.low === openValue ? coordinate.high : coordinate.low;
    return { anchor, tail: openValue };
  }
  return { anchor: spacedockValue, tail: spacedockValue };
}

export function formatTailCoordinate(
  lastTile: PlacedCoordinate | null,
  spacedockValue: number
): string {
  const { anchor, tail } = resolveTailEnds(lastTile, spacedockValue);
  return `${anchor}:${tail}`;
}

export function tailTileDisplayValues(last: PlacedCoordinate): {
  left: number;
  right: number;
} {
  const { anchor, tail } = resolveTailEnds(last, 0);
  return { left: anchor, right: tail };
}

function TailCoordinateText({
  anchor,
  tail,
  className,
  title,
  compact = false,
}: {
  anchor: number;
  tail: number;
  className?: string;
  title?: string;
  compact?: boolean;
}) {
  return (
    <span
      className={compact ? styles.coordinateInline : className}
      title={title ?? `${anchor}:${tail}`}
    >
      <span className={styles.coordinateAnchor}>{anchor}</span>
      <span className={styles.coordinateColon}>:</span>
      <span className={styles.coordinateTail}>{tail}</span>
    </span>
  );
}

function TailDomino({
  anchor,
  tail,
  tileBg,
}: {
  anchor: number;
  tail: number;
  tileBg: WarpTileBg;
}) {
  const tileSurface = WARP_TILE_SURFACE[tileBg];
  return (
    <span className={styles.dominoWrap} aria-hidden>
      <DoubleTwelve
        value1={anchor}
        value2={tail}
        width={22}
        height={44}
        rotation={-90}
        backgroundColor={tileSurface.fill}
        borderColor={tileSurface.border}
        pipColors={WARP_PIP_COLORS}
      />
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
  tacticalClassAbbrevByCaptain = {},
  tacticalClassLabelByCaptain = {},
}: CaptainTailsHudProps) {
  const rows = useMemo(
    () =>
      buildTailRows(
        round,
        trailSpokes,
        activePlayerId,
        tacticalClassAbbrevByCaptain,
        tacticalClassLabelByCaptain
      ),
    [
      activePlayerId,
      tacticalClassAbbrevByCaptain,
      tacticalClassLabelByCaptain,
      round,
      trailSpokes,
    ]
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
        {rows.map((row) => {
          const { anchor, tail } = resolveTailEnds(
            row.lastTile,
            row.connectValue
          );
          const coordinateTitle = row.lastTile
            ? `Tail ${anchor}:${tail} · open ${row.connectValue}`
            : `Spacedock ${anchor}:${tail} · open ${row.connectValue}`;

          const nameTitle = row.tacticalClassLabel
            ? `${row.label} · ${row.tacticalClassLabel}`
            : row.label;

          return (
            <li
              key={row.rowId}
              className={styles.row}
              data-display={display}
              data-active={row.isActive ? 'true' : undefined}
              data-state={row.state}
            >
              <span className={styles.nameCell} title={nameTitle}>
                <span className={styles.name}>{row.label}</span>
                {row.tacticalClassAbbrev && (
                  <span className={styles.tacticalClass}>
                    {row.tacticalClassAbbrev}
                  </span>
                )}
              </span>
              {display === 'domino' && (
                <TailDomino anchor={anchor} tail={tail} tileBg={tileBg} />
              )}
              <TailCoordinateText
                anchor={anchor}
                tail={tail}
                className={styles.coordinate}
                title={coordinateTitle}
                compact={display === 'domino'}
              />
            </li>
          );
        })}
      </ul>
      <p className={styles.hint}>
        {display === 'domino'
          ? 'Mini tile plus coordinate · empty lines show the spacedock double.'
          : 'Tail coordinate for each warp trail and Neutral zone (e.g. 12:6 — bold tail is open).'}
      </p>
    </FloatingPanelShell>
  );
}
