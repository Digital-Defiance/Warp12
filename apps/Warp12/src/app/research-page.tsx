import { Link } from 'react-router-dom';
import styles from './rules-view.module.scss';

export function ResearchPage() {
  return (
    <div className={styles.rulesPage}>
      <header className={styles.rulesPageHeader}>
        <h1 className={styles.rulesPageTitle}>
          Self-Play Calibration of Heuristic Agents for Mexican Train
        </h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <a 
            href="/tei-paper.pdf" 
            download
            className={styles.rulesPageBack}
            style={{ textDecoration: 'none' }}
          >
            Download PDF
          </a>
          <Link to="/" className={styles.rulesPageBack}>
            Back to the bridge
          </Link>
        </div>
      </header>
      <div className={styles.rulesPageBody}>
        <object
          data="/tei-paper.pdf"
          type="application/pdf"
          style={{
            width: '100%',
            height: 'calc(100vh - 200px)',
            minHeight: '600px',
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
  );
}
