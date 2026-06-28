import type { ReactNode, RefObject } from 'react';

import shellStyles from './floating-panel-shell.module.scss';
import {
  useFloatingPanel,
  type FloatingPanelAnchor,
} from './use-floating-panel';

export interface FloatingPanelShellProps {
  containerRef: RefObject<HTMLElement | null>;
  storageKey: string;
  defaultAnchor?: FloatingPanelAnchor;
  title: string;
  titleAdornment?: ReactNode;
  width?: number;
  accent?: 'cyan' | 'amber';
  children: ReactNode;
}

export function FloatingPanelShell({
  containerRef,
  storageKey,
  defaultAnchor = 'bottom-left',
  title,
  titleAdornment,
  width = 300,
  accent = 'cyan',
  children,
}: FloatingPanelShellProps) {
  const { panelRef, anchor, style, headerHandlers } = useFloatingPanel(
    containerRef,
    storageKey,
    defaultAnchor
  );

  return (
    <div
      ref={panelRef}
      className={shellStyles.panel}
      data-anchor={anchor}
      data-accent={accent}
      style={{ ...style, width: `min(${width}px, calc(100% - 24px))`, maxWidth: width }}
    >
      <div className={shellStyles.header} {...headerHandlers}>
        <span className={shellStyles.grip} aria-hidden>
          ⠿
        </span>
        {titleAdornment}
        <span className={shellStyles.headerTitle}>{title}</span>
      </div>
      <div className={shellStyles.body}>{children}</div>
    </div>
  );
}
