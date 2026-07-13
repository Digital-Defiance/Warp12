import { useEffect } from 'react';
import styles from './rules-view.module.scss';

interface ResearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ResearchDialog({ open, onClose }: ResearchDialogProps) {
  useEffect(() => {
    if (!open) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={styles.dialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="warp12-research-dialog-title"
      onClick={onClose}
    >
      <div
        className={styles.dialogPanel}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <h2 id="warp12-research-dialog-title" className={styles.dialogTitle}>
            Research Paper
          </h2>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <a 
              href="/tei-paper.pdf" 
              download
              style={{ 
                color: '#38bdf8', 
                textDecoration: 'none',
                fontSize: '0.9rem'
              }}
            >
              Download PDF
            </a>
            <button
              type="button"
              className={styles.dialogClose}
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </header>
        <div className={styles.dialogBody}>
          <object
            data="/tei-paper.pdf"
            type="application/pdf"
            style={{
              width: '100%',
              height: 'calc(100vh - 250px)',
              minHeight: '500px',
              border: '1px solid var(--warp-panel-border, #334155)',
              borderRadius: '4px',
            }}
          >
            <div style={{ 
              background: 'rgba(251, 191, 36, 0.1)', 
              border: '1px solid rgba(251, 191, 36, 0.3)',
              padding: '2rem',
              borderRadius: '4px',
              color: '#fbbf24',
              textAlign: 'center'
            }}>
              <p><strong>PDF viewer not supported in this browser.</strong></p>
              <p>
                <a 
                  href="/tei-paper.pdf" 
                  download
                  style={{ color: '#38bdf8', textDecoration: 'underline' }}
                >
                  Click here to download the PDF
                </a>
              </p>
            </div>
          </object>
        </div>
      </div>
    </div>
  );
}
