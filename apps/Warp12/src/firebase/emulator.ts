/** True when the client should talk to local Firebase emulators (e2e / dev). */
export function useFirebaseEmulators(): boolean {
  return (
    import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true' ||
    import.meta.env.VITE_FUNCTIONS_EMULATOR === 'true'
  );
}

export const FIREBASE_EMULATOR_HOSTS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8080 },
  functions: { host: '127.0.0.1', port: 5001 },
} as const;
