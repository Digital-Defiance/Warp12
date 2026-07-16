import { Link } from 'react-router-dom';

import { ManualViewer } from './manual-viewer';
import styles from './rules-view.module.scss';

export function RulesPage() {
  return (
    <div className={`${styles.rulesPage} ${styles.rulesPageWide}`}>
      <header className={styles.rulesPageHeader}>
        <h1 className={styles.rulesPageTitle}>Navigational Operations Manual</h1>
        <Link to="/" className={styles.rulesPageBack}>
          Back to the bridge
        </Link>
      </header>
      <div className={styles.rulesPageBody}>
        <ManualViewer variant="page" />
      </div>
    </div>
  );
}
