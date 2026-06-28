import { Link } from 'react-router-dom';

import { WARP12_PRIVACY_MARKDOWN } from '../content/privacy-source';
import { RulesMarkdown } from './rules-markdown';
import styles from './rules-view.module.scss';

export function PrivacyPage() {
  return (
    <div className={styles.rulesPage}>
      <header className={styles.rulesPageHeader}>
        <h1 className={styles.rulesPageTitle}>Privacy Policy</h1>
        <Link to="/" className={styles.rulesPageBack}>
          Back to the bridge
        </Link>
      </header>
      <div className={styles.rulesPageBody}>
        <RulesMarkdown source={WARP12_PRIVACY_MARKDOWN} />
      </div>
    </div>
  );
}
