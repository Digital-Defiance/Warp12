import { useState } from 'react';

import { WARP12_RULES_HTML } from '../content/rules-source';
import type { LayoutTier } from './layout-tier.js';
import { useLayoutTier } from './layout-tier-context';
import { RulesHtml } from './rules-html';
import styles from './rules-view.module.scss';

export const RULES_PDF_HREF = '/rules.pdf';

const VIEW_PREF_KEY = 'warp12-manual-view';

export type ManualViewMode = 'pdf' | 'html';

/** Smart default when the captain has never chosen: HTML on phone (PDF embeds
 *  are unreliable there); typeset PDF on tablet/desktop. */
export function defaultManualViewForTier(tier: LayoutTier): ManualViewMode {
  return tier === 'phone' ? 'html' : 'pdf';
}

function readStoredView(): ManualViewMode | null {
  try {
    const raw = localStorage.getItem(VIEW_PREF_KEY);
    if (raw === 'html' || raw === 'pdf') {
      return raw;
    }
  } catch {
    // private mode / blocked storage
  }
  return null;
}

function writeStoredView(mode: ManualViewMode): void {
  try {
    localStorage.setItem(VIEW_PREF_KEY, mode);
  } catch {
    // ignore
  }
}

interface ManualViewToggleProps {
  value: ManualViewMode;
  onChange: (mode: ManualViewMode) => void;
}

/** Segmented PDF / HTML control — PDF is the typeset source of truth. */
export function ManualViewToggle({ value, onChange }: ManualViewToggleProps) {
  const setMode = (mode: ManualViewMode) => {
    writeStoredView(mode);
    onChange(mode);
  };

  return (
    <div
      className={styles.viewToggle}
      role="group"
      aria-label="Manual view format"
    >
      <button
        type="button"
        className={
          value === 'pdf' ? styles.viewToggleActive : styles.viewToggleBtn
        }
        aria-pressed={value === 'pdf'}
        onClick={() => setMode('pdf')}
      >
        PDF
      </button>
      <button
        type="button"
        className={
          value === 'html' ? styles.viewToggleActive : styles.viewToggleBtn
        }
        aria-pressed={value === 'html'}
        onClick={() => setMode('html')}
      >
        HTML
      </button>
    </div>
  );
}

interface ManualPdfEmbedProps {
  /** Taller viewport for the full-page viewer; dialogs use a shorter calc. */
  variant?: 'page' | 'dialog';
}

export function ManualPdfEmbed({ variant = 'page' }: ManualPdfEmbedProps) {
  return (
    <object
      data={RULES_PDF_HREF}
      type="application/pdf"
      className={
        variant === 'dialog' ? styles.pdfEmbedDialog : styles.pdfEmbed
      }
      aria-label="Navigational Operations Manual PDF"
    >
      <div className={styles.pdfFallback} role="status">
        <p>
          <strong>PDF viewer not supported in this browser.</strong>
        </p>
        <p>
          <a href={RULES_PDF_HREF} download>
            Download the manual PDF
          </a>
          , or switch to the HTML view.
        </p>
      </div>
    </object>
  );
}

interface ManualViewerProps {
  variant?: 'page' | 'dialog';
}

/**
 * Manual body with PDF / HTML toggle. Preference persists once chosen;
 * until then phone defaults to HTML and tablet/desktop to the typeset PDF.
 */
export function ManualViewer({ variant = 'page' }: ManualViewerProps) {
  const layoutTier = useLayoutTier();
  const [explicitMode, setExplicitMode] = useState<ManualViewMode | null>(() =>
    readStoredView()
  );
  const mode =
    explicitMode ?? defaultManualViewForTier(layoutTier);

  return (
    <div className={styles.manualViewer}>
      <div className={styles.manualToolbar}>
        <ManualViewToggle
          value={mode}
          onChange={(next) => setExplicitMode(next)}
        />
        {mode === 'pdf' ? (
          <a
            href={RULES_PDF_HREF}
            download
            className={styles.manualDownload}
          >
            Download PDF
          </a>
        ) : null}
      </div>
      {mode === 'pdf' ? (
        <ManualPdfEmbed variant={variant} />
      ) : (
        <div className={styles.manualHtmlPane}>
          <RulesHtml source={WARP12_RULES_HTML} />
        </div>
      )}
    </div>
  );
}
