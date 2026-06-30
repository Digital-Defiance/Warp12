import { Link, NavLink, useLocation } from 'react-router-dom';

import {
  WARP12_CALIBRATION_LOG_MARKDOWN,
  WARP12_PAPER_OUTLINE_MARKDOWN,
} from '../content/paper-source';
import { RulesMarkdown } from './rules-markdown';
import styles from './rules-view.module.scss';
import navStyles from './paper-page.module.scss';

function PaperNav() {
  return (
    <nav className={navStyles.subnav} aria-label="Research documents">
      <NavLink
        to="/paper"
        end
        className={({ isActive }) =>
          isActive ? navStyles.subnavLinkActive : navStyles.subnavLink
        }
      >
        Research outline
      </NavLink>
      <NavLink
        to="/paper/log"
        className={({ isActive }) =>
          isActive ? navStyles.subnavLinkActive : navStyles.subnavLink
        }
      >
        Calibration log
      </NavLink>
    </nav>
  );
}

export function PaperPage() {
  const location = useLocation();
  const isLog = location.pathname.endsWith('/log');
  const title = isLog ? 'Calibration log' : 'TEI & engine research (draft)';
  const source = isLog
    ? WARP12_CALIBRATION_LOG_MARKDOWN
    : WARP12_PAPER_OUTLINE_MARKDOWN;

  return (
    <div className={styles.rulesPage}>
      <header className={styles.rulesPageHeader}>
        <div>
          <PaperNav />
          <h1 className={styles.rulesPageTitle}>{title}</h1>
        </div>
        <Link to="/about" className={styles.rulesPageBack}>
          About Warp 12
        </Link>
      </header>
      <div className={styles.rulesPageBody}>
        <RulesMarkdown source={source} />
      </div>
    </div>
  );
}
