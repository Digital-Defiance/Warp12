import type { RefObject } from 'react';

import { CoachPanel, type CoachPanelProps } from './coach-panel';
import { FloatingPanelShell } from './floating-panel-shell';
import shellStyles from './floating-panel-shell.module.scss';

const STORAGE_KEY = 'warp12-coach-hud-pos';

export interface FloatingCoachPanelProps extends CoachPanelProps {
  containerRef: RefObject<HTMLElement | null>;
}

export function FloatingCoachPanel({
  containerRef,
  ...coachProps
}: FloatingCoachPanelProps) {
  return (
    <FloatingPanelShell
      containerRef={containerRef}
      storageKey={STORAGE_KEY}
      defaultAnchor="bottom-left"
      title="Tactical advisor"
      titleAdornment={
        <span className={shellStyles.advisorBadge} aria-hidden>
          ★
        </span>
      }
      width={340}
      accent="amber"
    >
      <CoachPanel embedded {...coachProps} />
    </FloatingPanelShell>
  );
}
