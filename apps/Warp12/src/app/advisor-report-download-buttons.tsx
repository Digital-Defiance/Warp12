import styles from './advisor-report-download-buttons.module.scss';

import { ALL_CAPTAINS_ADVISOR_ICON } from '../game/captain-profile.js';

export interface AdvisorReportDownloadButtonsProps {
  pilotIconSrc: string;
  onDownloadYourMoves: () => void;
  onDownloadAllCaptains: () => void;
}

export function AdvisorReportDownloadButtons({
  pilotIconSrc,
  onDownloadYourMoves,
  onDownloadAllCaptains,
}: AdvisorReportDownloadButtonsProps) {
  return (
    <div className={styles.row}>
      <span className={styles.label}>Advisor Report</span>
      <div className={styles.buttons}>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onDownloadAllCaptains}
          title="All Captains"
          aria-label="All Captains"
        >
          <img src={ALL_CAPTAINS_ADVISOR_ICON} alt="" className={styles.icon} />
        </button>
        <button
          type="button"
          className={styles.iconBtn}
          onClick={onDownloadYourMoves}
          title="Solo Mission Review"
          aria-label="Solo Mission Review"
        >
          <img src={pilotIconSrc} alt="" className={styles.icon} />
        </button>
      </div>
    </div>
  );
}
