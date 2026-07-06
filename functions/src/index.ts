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

// Public callable access is applied post-deploy via scripts/ensure-functions-public-invoker.sh
// (--no-invoker-iam-check). invoker: 'public' fails here when org policy blocks allUsers.
setGlobalOptions({ region: 'us-central1' });

export {
  approveRatedMatch,
  bootstrapAdmin,
  checkInToMatch,
  createCharter,
  createRatedMatch,
  getCharter,
  getCharterLeaderboard,
  getCharterManageInfo,
  getMyRoles,
  joinCharter,
  leaveCharter,
  listCharterJoinRequests,
  listListedCharters,
  listMyCharters,
  rejectRatedMatch,
  reportOnlineMatch,
  reportPracticeAiMatch,
  requestJoinCharter,
  resolveJoinRequest,
  resetGlobalOfficialSeason,
  rotateCharterInvite,
  setAcademyPlacement,
  setUserRoles,
  submitMatchStandings,
  updateCharterListing,
};
