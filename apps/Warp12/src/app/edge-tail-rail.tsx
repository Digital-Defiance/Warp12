import { useMemo } from 'react';

import type { RoundState } from 'warp12-engine';
import type { TrailSpokeStatus } from 'warp12-react';
import type { CaptainTailsDisplay } from './table-view-prefs';
import {
  buildTailRows,
  resolveTailEnds,
  type TailRow,
} from './captain-tails-hud';
import styles from './edge-tail-rail.module.scss';

export interface EdgeTailRailProps {
  round: RoundState;
  trailSpokes: readonly TrailSpokeStatus[];
  activePlayerId: string;
  display: CaptainTailsDisplay;
  tacticalClassAbbrevByCaptain?: Readonly<Record<string, string>>;
  tacticalClassLabelByCaptain?: Readonly<Record<string, string>>;
}

function stateGlyph(state: TailRow['state']): string {
  switch (state) {
    case 'open':
      return '◉';
    case 'neutral':
      return '◎';
    case 'red-alert':
      return '!';
    case 'shields':
      return '◆';
  }
}

function rowInitial(label: string, rowId: string): string {
  if (rowId === 'neutral-zone') {
    return 'NZ';
  }
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return label.slice(0, 2).toUpperCase();
}

export function EdgeTailRail({
  round,
  trailSpokes,
  activePlayerId,
  display,
  tacticalClassAbbrevByCaptain = {},
  tacticalClassLabelByCaptain = {},
}: EdgeTailRailProps) {
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
    <aside className={styles.rail} aria-label="Trail tails">
      <ul className={styles.list}>
        {rows.map((row) => {
          const { tail } = resolveTailEnds(row.lastTile, row.connectValue);
          const title = row.tacticalClassLabel
            ? `${row.label} · ${row.tacticalClassLabel} · open ${tail}`
            : `${row.label} · open ${tail}`;

          return (
            <li
              key={row.rowId}
              className={styles.row}
              data-active={row.isActive ? 'true' : undefined}
              data-state={row.state}
              title={title}
            >
              <span className={styles.initials} aria-hidden>
                {rowInitial(row.label, row.rowId)}
              </span>
              <span className={styles.glyph} aria-hidden>
                {stateGlyph(row.state)}
              </span>
              <span className={styles.pip}>{display === 'domino' ? tail : tail}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
