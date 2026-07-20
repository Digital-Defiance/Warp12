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
  FirestoreRoundMove,
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
  addAiCaptain,
  clearSpectatorGallery,
  dissolveLobby,
  generateGameCode,
  joinLobby,
  kickCaptain,
  launchOnlineGame,
  leaveLobby,
  lobbyDocumentToState,
  markLobbyCaptainVerified,
  resetSectorToLobby,
  subscribeLobby,
  subscribeOnlineGame,
  submitOnlineAction,
  fetchHostDebugSnapshot,
  updateAiCaptain,
  updateCaptainSpeakAs,
  updateLobbySettings,
  type AddAiCaptainOptions,
  type CreateLobbyOptions,
  type HostDebugFirestoreSnapshot,
  type OnlineGameSnapshot,
  type UpdateAiCaptainPatch,
} from './game-service.js';

export { pauseSector, resumeSector } from './sector-pause.js';
export {
  SEAT_HEARTBEAT_MS,
  SEAT_STALE_MS,
  isSeatStale,
  pingSeatPresence,
} from './seat-presence.js';
export { hostDropCaptain } from './host-drop-captain.js';
export {
  hostLeaveWithAi,
  hostMuteInSector,
  hostReplaceCaptainWithAi,
  hostTransferHost,
  hostUnmuteInSector,
} from './host-continuity.js';

export { subscribeAiHands, subscribeHostAiHands, fetchAiCaptainHand } from './ai-hands.js';
export { canHostProxyAiMove, assertActorMaySubmit } from './ai-proxy.js';

export { useFirebaseAuth } from './use-firebase-auth.js';
