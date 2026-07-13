import { Link } from 'react-router-dom';

import { WARP12_RULES_HTML } from '../content/rules-source';
import { RulesHtml } from './rules-html';
import styles from './rules-view.module.scss';

export function RulesPage() {
  return (
    <div className={styles.rulesPage}>
      <header className={styles.rulesPageHeader}>
        <h1 className={styles.rulesPageTitle}>Navigational Operations Manual</h1>
        <Link to="/" className={styles.rulesPageBack}>
          Back to the bridge
        </Link>
      </header>
      <div className={styles.rulesPageBody}>
        <RulesHtml source={WARP12_RULES_HTML} />
      </div>
    </div>
  );
}
