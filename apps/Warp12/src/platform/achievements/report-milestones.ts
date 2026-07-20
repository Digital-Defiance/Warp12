/**
 * Fire-and-forget platform achievement unlocks from game milestones.
 * Never throws into UI paths; never touches TEI.
 */

import { unlockAchievement } from './platform-achievements.js';
import type { WarpAchievementId } from './catalog.js';

function fire(id: WarpAchievementId): void {
  void unlockAchievement(id).catch(() => {
    /* platform unlocks must not break play */
  });
}

/** First time the Bridge UI mounts after install. */
export function reportBridgeLaunch(): void {
  fire('first_launch');
}

/** Any finished sector / match (local or online). */
export function reportSectorComplete(options?: {
  readonly maxPip?: number;
}): void {
  fire('first_sector');
  if (options?.maxPip === 9) {
    fire('exhibition_warp9');
  }
}

/** Points or Go-out campaign finished. */
export function reportCampaignComplete(options?: {
  readonly maxPip?: number;
}): void {
  fire('campaign_complete');
  reportSectorComplete(options);
}

export function reportAllStop(): void {
  fire('first_all_stop');
}

export function reportBeaconRaised(): void {
  fire('first_beacon');
}
