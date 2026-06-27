export {
  FIRESTORE_COLLECTIONS,
  getFirebaseApp,
  getFirebaseAuth,
  getFirestoreDb,
  isFirebaseConfigured,
  type FirebaseConfig,
} from './config.js';

export type {
  FirestoreActionDocument,
  FirestoreCaptain,
  FirestoreGameDocument,
  FirestorePlayerHandDocument,
  FirestorePublicRound,
  OnlineLobbySettings,
} from './schema.js';

export {
  ONLINE_MAX_PLAYERS,
  ONLINE_MIN_PLAYERS,
  clampOnlineMaxPlayers,
} from './schema.js';

export {
  COACH_FLASH_MS,
  resolveCoachIndicator,
  signalCoachRequest,
  subscribeCoachPresence,
  type CoachIndicator,
  type CoachPresence,
} from './coach-presence.js';

export {
  createLobby,
  dissolveLobby,
  generateGameCode,
  joinLobby,
  kickCaptain,
  launchOnlineGame,
  leaveLobby,
  lobbyDocumentToState,
  resetSectorToLobby,
  subscribeLobby,
  subscribeOnlineGame,
  submitOnlineAction,
  updateLobbySettings,
  type CreateLobbyOptions,
  type OnlineGameSnapshot,
} from './game-service.js';

export { useFirebaseAuth } from './use-firebase-auth.js';
