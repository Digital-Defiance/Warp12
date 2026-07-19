import type { PlacedCoordinate, RoundState, TeiGrade } from 'warp12-engine';
import { trailKeyFor, squadronForPlayer } from 'warp12-engine';
import { DominoTile } from 'double-eighteen-react';
import type { RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import type { TrailAccessState, TrailSpokeStatus } from 'warp12-react';
import { WARP_PIP_COLORS, WARP_TILE_SURFACE, type WarpTileBg } from 'warp12-theme';
import { FloatingPanelShell } from './floating-panel-shell';
import type {
  CaptainTailsCoordinate,
  CaptainTailsDisplay,
} from './table-view-prefs';
import { TeiGradeBadge } from './components/tei-grade-badge';
import styles from './captain-tails-hud.module.scss';

const STORAGE_KEY = 'warp12-captain-tails-hud-pos';

export interface TailRow {
  readonly rowId: string;
  readonly label: string;
  readonly tacticalClassAbbrev?: string;
  readonly tacticalClassLabel?: string;
  readonly teiGrade?: TeiGrade;
  readonly connectValue: number;
  readonly lastTile: PlacedCoordinate | null;
  readonly state: TrailAccessState;
  readonly isActive: boolean;
  readonly hasHazardMarker?: boolean;
  readonly trailLength?: number;
  /** Module Zeta: squad id, when squads are enabled — drives row color-coding. */
  readonly squadronId?: string;
}

export interface CaptainTailsHudProps {
  containerRef: RefObject<HTMLElement | null>;
  round: RoundState;
  trailSpokes: readonly TrailSpokeStatus[];
  activePlayerId: string;
  display: CaptainTailsDisplay;
  /** Coordinate readout: full `X:Y`, tail-only, or hidden. Defaults to full. */
  coordinate?: CaptainTailsCoordinate;
  /** Show the per-trail tile-count badge. Defaults to true. */
  showTrailLength?: boolean;
  tileBg: WarpTileBg;
  tacticalClassAbbrevByCaptain?: Readonly<Record<string, string>>;
  tacticalClassLabelByCaptain?: Readonly<Record<string, string>>;
  teiGradeByCaptain?: Readonly<Record<string, TeiGrade>>;
  /** Double-N max pip for tile rendering. */
  maxPip?: number;
  /** Module Delta enabled (for hazard marker display). */
  moduleDeltaEnabled?: boolean;
}

export function buildTailRows(
  round: RoundState,
  trailSpokes: readonly TrailSpokeStatus[],
  activePlayerId: string,
  tacticalClassAbbrevByCaptain: Readonly<Record<string, string>> = {},
  tacticalClassLabelByCaptain: Readonly<Record<string, string>> = {},
  teiGradeByCaptain: Readonly<Record<string, TeiGrade>> = {},
  moduleDeltaEnabled = false
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
    // Module Zeta: squad members share one trail keyed by trailKeyFor — never
    // index warpTrails by the captain's own id directly, or squadmates who
    // aren't the trail's canonical owner would show an empty/wrong trail.
    const trail = round.table.warpTrails[trailKeyFor(round, captainId)];
    const lastTile =
      trail && trail.tiles.length > 0
        ? trail.tiles[trail.tiles.length - 1]
        : null;
    const squadronId = squadronForPlayer(round.squadrons, captainId)?.id;

    return {
      rowId: captainId,
      label: spoke?.label ?? captainId,
      ...(tacticalClassAbbrevByCaptain[captainId]
        ? {
            tacticalClassAbbrev: tacticalClassAbbrevByCaptain[captainId],
            tacticalClassLabel: tacticalClassLabelByCaptain[captainId],
          }
        : {}),
      ...(teiGradeByCaptain[captainId]
        ? { teiGrade: teiGradeByCaptain[captainId] }
        : {}),
      connectValue: spoke?.connectValue ?? round.spacedockValue,
      lastTile,
      state: spoke?.state ?? 'shields',
      isActive: captainId === activePlayerId,
      hasHazardMarker: moduleDeltaEnabled && round.hazardMarkerHolder === captainId,
      trailLength: trail?.tiles.length ?? 0,
      ...(squadronId ? { squadronId } : {}),
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
      hasHazardMarker: false,
      trailLength: neutralTiles.length,
    },
  ];
}

export function buildCaptainTailRows(
  round: RoundState,
  trailSpokes: readonly TrailSpokeStatus[],
  activePlayerId: string,
  tacticalClassAbbrevByCaptain?: Readonly<Record<string, string>>,
  tacticalClassLabelByCaptain?: Readonly<Record<string, string>>,
  teiGradeByCaptain?: Readonly<Record<string, TeiGrade>>
): TailRow[] {
  return buildTailRows(
    round,
    trailSpokes,
    activePlayerId,
    tacticalClassAbbrevByCaptain,
    tacticalClassLabelByCaptain,
    teiGradeByCaptain
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
  tailOnly = false,
}: {
  anchor: number;
  tail: number;
  className?: string;
  title?: string;
  compact?: boolean;
  tailOnly?: boolean;
}) {
  return (
    <span
      className={compact ? styles.coordinateInline : className}
      title={title ?? `${anchor}:${tail}`}
    >
      {tailOnly ? (
        <span className={styles.coordinateTail}>{tail}</span>
      ) : (
        <>
          <span className={styles.coordinateAnchor}>{anchor}</span>
          <span className={styles.coordinateColon}>:</span>
          <span className={styles.coordinateTail}>{tail}</span>
        </>
      )}
    </span>
  );
}

function TailDomino({
  anchor,
  tail,
  tileBg,
  maxPip = 12,
}: {
  anchor: number;
  tail: number;
  tileBg: WarpTileBg;
  maxPip?: number;
}) {
  const tileSurface = WARP_TILE_SURFACE[tileBg];
  return (
    <span className={styles.dominoWrap} aria-hidden>
      <DominoTile
        maxPips={maxPip}
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
  coordinate = 'full',
  showTrailLength = true,
  tileBg,
  tacticalClassAbbrevByCaptain = {},
  tacticalClassLabelByCaptain = {},
  teiGradeByCaptain = {},
  maxPip = 12,
  moduleDeltaEnabled = false,
}: CaptainTailsHudProps) {
  const rows = useMemo(
    () =>
      buildTailRows(
        round,
        trailSpokes,
        activePlayerId,
        tacticalClassAbbrevByCaptain,
        tacticalClassLabelByCaptain,
        teiGradeByCaptain,
        moduleDeltaEnabled
      ),
    [
      activePlayerId,
      tacticalClassAbbrevByCaptain,
      tacticalClassLabelByCaptain,
      teiGradeByCaptain,
      moduleDeltaEnabled,
      round,
      trailSpokes,
    ]
  );
  const activeRowRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [activePlayerId, rows.length]);

  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={STORAGE_KEY}
      defaultAnchor="bottom-right"
      title="Fleet Status"
      width={300}
      resizableWidth
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
              ref={row.isActive ? activeRowRef : undefined}
              className={styles.row}
              data-display={display}
              data-coord={coordinate}
              data-active={row.isActive ? 'true' : undefined}
              data-state={row.state}
              data-hazard={row.hasHazardMarker ? 'true' : undefined}
              data-squadron={row.squadronId}
            >
              <span className={styles.nameCell} title={nameTitle}>
                <span className={styles.name}>
                  {row.label}
                  <span className={styles.stateIndicators}>
                    {row.state === 'open' && (
                      <span className={styles.shieldIcon} title="Shields down (trail open)">◉</span>
                    )}
                    {row.state === 'neutral' && (
                      <span className={styles.neutralIcon} title="Neutral zone">◎</span>
                    )}
                    {row.hasHazardMarker && (
                      <span className={styles.hazardMarker} title="Hazard Marker (+5 per pass)">
                        ⚠️
                      </span>
                    )}
                  </span>
                </span>
                {display !== 'domino' && (
                  <>
                    {row.teiGrade && (
                      <TeiGradeBadge grade={row.teiGrade} size="small" />
                    )}
                    {row.tacticalClassAbbrev && (
                      <span className={styles.tacticalClass}>
                        {row.tacticalClassAbbrev}
                      </span>
                    )}
                    {showTrailLength &&
                      row.trailLength !== undefined &&
                      row.trailLength > 0 && (
                        <span
                          className={styles.trailLength}
                          title={`Trail length: ${row.trailLength} tiles`}
                        >
                          {row.trailLength}
                        </span>
                      )}
                  </>
                )}
              </span>
              {display === 'domino' ? (
                <>
                  <span className={styles.rankCell}>
                    {row.teiGrade ? (
                      <TeiGradeBadge grade={row.teiGrade} size="small" />
                    ) : null}
                    {row.tacticalClassAbbrev ? (
                      <span className={styles.tacticalClass}>
                        {row.tacticalClassAbbrev}
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.trailCell}>
                    {showTrailLength &&
                    row.trailLength !== undefined &&
                    row.trailLength > 0 ? (
                      <span
                        className={styles.trailLength}
                        title={`Trail length: ${row.trailLength} tiles`}
                      >
                        {row.trailLength}
                      </span>
                    ) : null}
                  </span>
                  <TailDomino
                    anchor={anchor}
                    tail={tail}
                    tileBg={tileBg}
                    maxPip={maxPip}
                  />
                </>
              ) : null}
              {coordinate !== 'off' && (
                <TailCoordinateText
                  anchor={anchor}
                  tail={tail}
                  className={styles.coordinate}
                  title={coordinateTitle}
                  compact={display === 'domino'}
                  tailOnly={coordinate === 'tail'}
                />
              )}
            </li>
          );
        })}
      </ul>
      <p className={styles.hint}>
        {display === 'domino'
          ? coordinate === 'off'
            ? 'Mini tile for each warp trail and Neutral zone · empty lines show the spacedock double.'
            : coordinate === 'tail'
              ? 'Mini tile plus open tail value · empty lines show the spacedock double.'
              : 'Mini tile plus coordinate · empty lines show the spacedock double.'
          : coordinate === 'off'
            ? 'Warp trails and Neutral zone at a glance — coordinates hidden.'
            : coordinate === 'tail'
              ? 'Open tail value for each warp trail and Neutral zone (the number in play).'
              : 'Tail coordinate for each warp trail and Neutral zone (e.g. 12:6 — bold tail is open).'}
      </p>
    </FloatingPanelShell>
  );
}
