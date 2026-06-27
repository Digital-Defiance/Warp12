import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

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
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'warp-12.firebaseapp.com',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'warp-12',
    storageBucket:
      import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ??
      'warp-12.firebasestorage.app',
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

  auth ??= getAuth(firebaseApp);
  return auth;
}

export function getFirestoreDb(): Firestore | null {
  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) {
    return null;
  }

  db ??= getFirestore(firebaseApp);
  return db;
}

export const FIRESTORE_COLLECTIONS = {
  games: 'games',
  actions: 'actions',
  players: 'players',
} as const;
