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
import { reportPracticeAiMatch } from './report-practice-ai';
import { setAcademyPlacement } from './set-academy-placement';

setGlobalOptions({ region: 'us-central1', invoker: 'public' });

export {
  approveRatedMatch,
  bootstrapAdmin,
  checkInToMatch,
  createRatedMatch,
  getMyRoles,
  rejectRatedMatch,
  reportPracticeAiMatch,
  setAcademyPlacement,
  setUserRoles,
  submitMatchStandings,
};
