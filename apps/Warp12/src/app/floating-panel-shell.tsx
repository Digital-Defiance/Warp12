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
  /** Initial width (px). When resizableWidth, a persisted width overrides this. */
  width?: number;
  /** Enable a horizontal drag handle that resizes + persists the panel width. */
  resizableWidth?: boolean;
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
  resizableWidth = false,
  accent = 'cyan',
  panelClassName,
  children,
}: FloatingPanelShellProps) {
  const {
    panelRef,
    anchor,
    style,
    width: storedWidth,
    resizeEdge,
    dragging,
    touchPrimary,
    headerHandlers,
    panelHandlers,
    resizeHandlers,
    widthResizeHandlers,
  } = useFloatingPanel(containerRef, storageKey, defaultAnchor, bounds);

  const hasCustomWidth = resizableWidth && storedWidth != null;

  const panel = (
    <div
      ref={panelRef}
      className={`${shellStyles.panel}${panelClassName ? ` ${panelClassName}` : ''}`}
      data-anchor={anchor}
      data-accent={accent}
      data-bounds={bounds}
      data-dragging={dragging ? 'true' : undefined}
      data-touch-drag={touchPrimary ? 'true' : undefined}
      style={{
        ...style,
        width: hasCustomWidth
          ? `min(${storedWidth}px, calc(100vw - 24px))`
          : `min(${width}px, calc(100vw - 24px))`,
        maxWidth: hasCustomWidth ? 'calc(100vw - 24px)' : width,
      }}
      {...panelHandlers}
    >
      <div
        className={shellStyles.header}
        data-floating-panel-header
        {...headerHandlers}
      >
        <span className={shellStyles.grip} aria-hidden>
          ⠿
        </span>
        {titleAdornment}
        <span className={shellStyles.headerTitle}>{title}</span>
      </div>
      <div className={shellStyles.body} data-floating-panel-body>
        {children}
      </div>
      {resizableWidth && (
        <div
          className={shellStyles.widthResizeHandle}
          data-edge={resizeEdge}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Resize ${title} panel width`}
          title="Drag to resize width"
          data-no-panel-drag
          {...widthResizeHandlers}
        />
      )}
      <div
        className={shellStyles.resizeHandle}
        role="separator"
        aria-orientation="horizontal"
        aria-label={`Resize ${title} panel`}
        title="Drag to resize"
        data-no-panel-drag
        {...resizeHandlers}
      />
    </div>
  );

  if (bounds === 'viewport' && typeof document !== 'undefined') {
    return createPortal(panel, document.body);
  }
  return panel;
}
