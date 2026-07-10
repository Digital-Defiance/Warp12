import type { CoachIndicator } from '../firebase/coach-presence';
import { spokeBadgeRingDistance, type TrailSpokeStatus } from 'warp12-react';
import styles from './trail-spoke-indicators.module.scss';

interface TrailSpokeIndicatorsProps {
  centerX: number;
  centerY: number;
  hubRadius: number;
  /** Distance to first train tile — badges sit in the gap for large fleets. */
  startDistance: number;
  hubSlots: number;
  spokes: readonly TrailSpokeStatus[];
  coachByCaptain?: Readonly<Record<string, CoachIndicator>>;
  tacticalClassLabelByCaptain?: Readonly<Record<string, string>>;
}

export function TrailSpokeIndicators({
  centerX,
  centerY,
  hubRadius,
  startDistance,
  hubSlots,
  spokes,
  coachByCaptain = {},
  tacticalClassLabelByCaptain = {},
}: TrailSpokeIndicatorsProps) {
  const badgeDistance = spokeBadgeRingDistance(
    hubSlots,
    hubRadius,
    startDistance
  );

  return (
    <>
      {spokes.map((spoke) => {
        const angle = (spoke.slot * 360) / hubSlots;
        const radians = (angle * Math.PI) / 180;
        const x = centerX + badgeDistance * Math.cos(radians);
        const y = centerY + badgeDistance * Math.sin(radians);

        const coach =
          spoke.captainId != null
            ? coachByCaptain[spoke.captainId]
            : undefined;
        const tacticalClass =
          spoke.captainId != null
            ? tacticalClassLabelByCaptain[spoke.captainId]
            : undefined;

        return (
          <div
            key={spoke.slot}
            className={styles.spokeBadge}
            data-state={spoke.state}
            style={{
              left: `${x}px`,
              top: `${y}px`,
            }}
            aria-label={badgeAriaLabel(spoke, coach, tacticalClass)}
          >
            <span className={styles.spokeIcon} aria-hidden>
              {stateIcon(spoke.state)}
            </span>
            <span className={styles.spokeLabel}>{stateLabel(spoke.state)}</span>
            <span className={styles.spokeTooltip} role="tooltip">
              {tooltipText(spoke, tacticalClass)}
            </span>
            {coach && (
              <span
                className={styles.coachBadge}
                data-flash={coach.flash}
                title="Tactical advisor engaged this round"
              >
                Advisor
              </span>
            )}
          </div>
        );
      })}
    </>
  );
}

function stateIcon(state: TrailSpokeStatus['state']): string {
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

function stateLabel(state: TrailSpokeStatus['state']): string {
  switch (state) {
    case 'open':
      return 'Open';
    case 'neutral':
      return 'Zone';
    case 'red-alert':
      return 'Alert';
    case 'shields':
      return 'Shields';
  }
}

function stateTitle(spoke: TrailSpokeStatus): string {
  switch (spoke.state) {
    case 'open':
      return 'Distress beacon — trail open to all captains';
    case 'neutral':
      return 'Neutral zone — open to all captains';
    case 'red-alert':
      return 'Red alert — double must be covered';
    case 'shields':
      return 'Shields up — own trail only';
  }
}

function tooltipText(
  spoke: TrailSpokeStatus,
  tacticalClass: string | undefined
): string {
  if (!spoke.captainId) {
    return 'Neutral Zone';
  }
  return tacticalClass ? `${spoke.label} · ${tacticalClass}` : spoke.label;
}

function badgeAriaLabel(
  spoke: TrailSpokeStatus,
  coach: CoachIndicator | undefined,
  tacticalClass: string | undefined
): string {
  const who = spoke.captainId ? spoke.label : 'Neutral Zone';
  const classPart = tacticalClass ? ` · ${tacticalClass}` : '';
  return `${who}${classPart} · ${stateTitle(spoke)} · connects on ${spoke.connectValue}${
    coach ? ' · tactical advisor engaged' : ''
  }`;
}
