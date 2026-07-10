import { createPortal } from 'react-dom';
import type { ReactNode, RefObject } from 'react';

import shellStyles from './floating-panel-shell.module.scss';
import {
  useFloatingPanel,
  type FloatingPanelAnchor,
  type FloatingPanelBounds,
} from './use-floating-panel';

export interface FloatingPanelShellProps {
  containerRef: RefObject<HTMLElement | null>;
  storageKey: string;
  defaultAnchor?: FloatingPanelAnchor;
  /** Clamp / portal target. Viewport escapes bridge overflow clipping. */
  bounds?: FloatingPanelBounds;
  title: string;
  titleAdornment?: ReactNode;
  width?: number;
  accent?: 'cyan' | 'amber';
  panelClassName?: string;
  children: ReactNode;
}

export function FloatingPanelShell({
  containerRef,
  storageKey,
  defaultAnchor = 'bottom-left',
  bounds = 'viewport',
  title,
  titleAdornment,
  width = 300,
  accent = 'cyan',
  panelClassName,
  children,
}: FloatingPanelShellProps) {
  const { panelRef, anchor, style, headerHandlers, resizeHandlers } =
    useFloatingPanel(containerRef, storageKey, defaultAnchor, bounds);

  const panel = (
    <div
      ref={panelRef}
      className={`${shellStyles.panel}${panelClassName ? ` ${panelClassName}` : ''}`}
      data-anchor={anchor}
      data-accent={accent}
      data-bounds={bounds}
      style={{
        ...style,
        width: `min(${width}px, calc(100vw - 24px))`,
        maxWidth: width,
      }}
    >
      <div className={shellStyles.header} {...headerHandlers}>
        <span className={shellStyles.grip} aria-hidden>
          ⠿
        </span>
        {titleAdornment}
        <span className={shellStyles.headerTitle}>{title}</span>
      </div>
      <div className={shellStyles.body}>{children}</div>
      <div
        className={shellStyles.resizeHandle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Resize ${title} panel`}
        title="Drag to resize"
        {...resizeHandlers}
      />
    </div>
  );

  if (bounds === 'viewport' && typeof document !== 'undefined') {
    return createPortal(panel, document.body);
  }
  return panel;
}
