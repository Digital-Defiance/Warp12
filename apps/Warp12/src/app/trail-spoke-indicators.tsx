import type { CoachIndicator } from '../firebase/coach-presence';
import type { TrailSpokeStatus } from 'warp12-react';
import styles from './trail-spoke-indicators.module.scss';

/** Distance from hub center to badge center — just outside the spacedock ring. */
const BADGE_HUB_PADDING = 12;

interface TrailSpokeIndicatorsProps {
  centerX: number;
  centerY: number;
  hubRadius: number;
  hubSlots: number;
  spokes: readonly TrailSpokeStatus[];
  coachByCaptain?: Readonly<Record<string, CoachIndicator>>;
}

export function TrailSpokeIndicators({
  centerX,
  centerY,
  hubRadius,
  hubSlots,
  spokes,
  coachByCaptain = {},
}: TrailSpokeIndicatorsProps) {
  const badgeDistance = hubRadius + BADGE_HUB_PADDING;

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

        return (
          <div
            key={spoke.slot}
            className={styles.spokeBadge}
            data-state={spoke.state}
            style={{
              left: `${x}px`,
              top: `${y}px`,
            }}
            aria-label={badgeAriaLabel(spoke, coach)}
          >
            <span className={styles.spokeIcon} aria-hidden>
              {stateIcon(spoke.state)}
            </span>
            <span className={styles.spokeLabel}>{stateLabel(spoke.state)}</span>
            <span className={styles.spokeTooltip} role="tooltip">
              {spoke.captainId ? spoke.label : 'Neutral Zone'}
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

function badgeAriaLabel(
  spoke: TrailSpokeStatus,
  coach: CoachIndicator | undefined
): string {
  const who = spoke.captainId ? spoke.label : 'Neutral Zone';
  return `${who} · ${stateTitle(spoke)} · connects on ${spoke.connectValue}${
    coach ? ' · tactical advisor engaged' : ''
  }`;
}
