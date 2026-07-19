import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from 'firebase/firestore';

import {
  FIREBASE_EMULATOR_HOSTS,
  useFirebaseEmulators,
} from './emulator.js';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

function readConfig(): FirebaseConfig {
  const config: FirebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? '',
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
    appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
  };

  return config;
}

export function isFirebaseConfigured(config: FirebaseConfig = readConfig()): boolean {
  return Boolean(config.apiKey && config.appId && config.messagingSenderId);
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let authEmulatorConnected = false;
let firestoreEmulatorConnected = false;

function connectAuthEmulatorIfNeeded(nextAuth: Auth): void {
  if (!useFirebaseEmulators() || authEmulatorConnected) {
    return;
  }
  connectAuthEmulator(nextAuth, FIREBASE_EMULATOR_HOSTS.auth, {
    disableWarnings: true,
  });
  authEmulatorConnected = true;
}

function connectFirestoreEmulatorIfNeeded(nextDb: Firestore): void {
  if (!useFirebaseEmulators() || firestoreEmulatorConnected) {
    return;
  }
  const { host, port } = FIREBASE_EMULATOR_HOSTS.firestore;
  connectFirestoreEmulator(nextDb, host, port);
  firestoreEmulatorConnected = true;
}

/** Lazily initialize Firebase when credentials are present. */
export function getFirebaseApp(): FirebaseApp | null {
  const config = readConfig();
  if (!isFirebaseConfigured(config)) {
    return null;
  }

  app ??= initializeApp(config);
  return app;
}

export function getFirebaseAuth(): Auth | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  if (!auth) {
    auth = getAuth(firebaseApp);
    connectAuthEmulatorIfNeeded(auth);
  }
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  if (!db) {
    db = getFirestore(firebaseApp);
    connectFirestoreEmulatorIfNeeded(db);
  }
  return db;
}

export const FIRESTORE_COLLECTIONS = {
  games: 'games',
  actions: 'actions',
  players: 'players',
} as const;
