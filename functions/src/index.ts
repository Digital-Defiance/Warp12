import './init';
import { setGlobalOptions } from 'firebase-functions/v2';

import {
  approveRatedMatch,
  bootstrapAdmin,
  checkInToMatch,
  createRatedMatch,
  getMyRoles,
  rejectRatedMatch,
  setUserRoles,
  submitMatchStandings,
} from './rated-matches';
import { reportOnlineMatch } from './report-online-match';
import { reportPracticeAiMatch } from './report-practice-ai';
import { setAcademyPlacement } from './set-academy-placement';
import {
  createCharter,
  getCharter,
  getCharterLeaderboard,
  getCharterManageInfo,
  joinCharter,
  leaveCharter,
  listCharterJoinRequests,
  listListedCharters,
  listMyCharters,
  requestJoinCharter,
  resolveJoinRequest,
  resetGlobalOfficialSeason,
  rotateCharterInvite,
  updateCharterListing,
} from './charters';
import { banUser, getBan, listBans, unbanUser } from './bans';
import {
  opsClearCharterJoinRequests,
  opsCloseCharter,
  opsGetCharter,
  opsListCharters,
  opsRemoveCharterMember,
} from './ops/charters';
import { listOpsAudit } from './ops/audit';
import { getOpsGame, getOpsHands, listActiveGames, searchGames } from './ops/games';
import {
  addAdminNote,
  deleteAdminNote,
  getCaptainDossier,
  listAdminNotes,
  opsSetDisplayName,
  searchCaptains,
  updateAdminNote,
} from './ops/captains';
import {
  deleteSectorMessage,
  listSectorMessages,
  redactSectorMessage,
  searchMessages,
} from './ops/messages';
import {
  getMute,
  listMutes,
  muteInSector,
  muteUser,
  unmuteInSector,
  unmuteUser,
} from './ops/mutes';
import {
  listStaleGames,
  opsCleanupStaleSector,
  opsKickCaptain,
  opsTerminateSector,
} from './ops/sector-actions';
import {
  joinSpectate,
  leaveSpectate,
  opsDropSpectators,
  setAllowSpectate,
} from './ops/spectate';
import {
  getOpsRatedMatch,
  listCaptainRatingEvents,
  listMatchRatingEvents,
  opsSetCaptainRating,
  opsVoidRatedMatch,
} from './ops/tei';
import { opsCascadeFromRatingEvent } from './ops/tei-cascade';
import { verifyMatchCertificate } from './verify-match-certificate';
import { countActiveSectors } from './public/active-sectors';
import {
  getContentReviewConfig,
  listModerationReports,
  onDisplayNameContentReview,
  onMessageContentReview,
  submitModerationReport,
  updateContentReviewConfig,
  updateModerationReport,
} from './moderation/reports';
import { getModerationEvidencePack } from './moderation/evidence-pack';
import { onRatingEventAbuseReview } from './moderation/rating-abuse';
import { onMessageShadowMute } from './moderation/shadow-mute';
import { opsUnrateOnlineSector } from './ops/unrate-online';

// Public callable access is applied post-deploy via scripts/ensure-functions-public-invoker.sh
// (--no-invoker-iam-check). invoker: 'public' fails here when org policy blocks allUsers.
setGlobalOptions({ region: 'us-central1' });

export {
  addAdminNote,
  approveRatedMatch,
  banUser,
  bootstrapAdmin,
  checkInToMatch,
  createCharter,
  createRatedMatch,
  countActiveSectors,
  deleteAdminNote,
  deleteSectorMessage,
  getBan,
  getCaptainDossier,
  getCharter,
  getCharterLeaderboard,
  getCharterManageInfo,
  getContentReviewConfig,
  getMute,
  getMyRoles,
  getOpsGame,
  getOpsHands,
  getOpsRatedMatch,
  getModerationEvidencePack,
  joinCharter,
  joinSpectate,
  leaveCharter,
  leaveSpectate,
  listActiveGames,
  listAdminNotes,
  listBans,
  listCaptainRatingEvents,
  listCharterJoinRequests,
  listListedCharters,
  listMatchRatingEvents,
  listModerationReports,
  listMutes,
  listMyCharters,
  listOpsAudit,
  listSectorMessages,
  listStaleGames,
  muteInSector,
  muteUser,
  onDisplayNameContentReview,
  onMessageContentReview,
  onMessageShadowMute,
  onRatingEventAbuseReview,
  opsCleanupStaleSector,
  opsCascadeFromRatingEvent,
  opsClearCharterJoinRequests,
  opsCloseCharter,
  opsDropSpectators,
  opsGetCharter,
  opsKickCaptain,
  opsListCharters,
  opsRemoveCharterMember,
  opsSetCaptainRating,
  opsSetDisplayName,
  opsTerminateSector,
  opsUnrateOnlineSector,
  opsVoidRatedMatch,
  rejectRatedMatch,
  reportOnlineMatch,
  reportPracticeAiMatch,
  requestJoinCharter,
  resolveJoinRequest,
  resetGlobalOfficialSeason,
  redactSectorMessage,
  rotateCharterInvite,
  searchCaptains,
  searchGames,
  searchMessages,
  setAcademyPlacement,
  setAllowSpectate,
  setUserRoles,
  submitMatchStandings,
  submitModerationReport,
  unbanUser,
  unmuteInSector,
  unmuteUser,
  updateAdminNote,
  updateCharterListing,
  updateContentReviewConfig,
  updateModerationReport,
  verifyMatchCertificate,
};
