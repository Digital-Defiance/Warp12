/**
 * Shared helpers for callable integration tests against the Firebase Emulator Suite.
 * Expects Auth :9099, Firestore :8080, Functions :5001 (see firebase.json).
 */

import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const E2E_PROJECT_ID =
  process.env.GCLOUD_PROJECT ??
  process.env.FIREBASE_E2E_PROJECT ??
  'demo-warp12';

export const AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '127.0.0.1:9099';
export const FIRESTORE_EMULATOR_HOST =
  process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
export const FUNCTIONS_EMULATOR_ORIGIN =
  process.env.FUNCTIONS_EMULATOR_ORIGIN ?? 'http://127.0.0.1:5001';

export class CallableError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly details: unknown;

  constructor(
    message: string,
    code: string,
    httpStatus: number,
    details?: unknown
  ) {
    super(message);
    this.name = 'CallableError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}

let adminReady = false;

/** Point Admin SDK at emulators and initialize once. */
export function ensureEmulatorAdmin(): Firestore {
  process.env.FIRESTORE_EMULATOR_HOST ??= FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= AUTH_EMULATOR_HOST;
  if (!adminReady) {
    if (getApps().length === 0) {
      initializeApp({ projectId: E2E_PROJECT_ID });
    }
    adminReady = true;
  }
  return getFirestore();
}

export interface EmulatorUserOptions {
  uid?: string;
  displayName?: string;
  /** Custom claims.roles — e.g. ['admin'], ['moderator']. */
  roles?: readonly string[];
}

export interface EmulatorUser {
  uid: string;
  idToken: string;
}

async function exchangeCustomToken(customToken: string): Promise<string> {
  const url = `http://${AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake-api-key`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: customToken, returnSecureToken: true }),
  });
  const body = (await res.json()) as {
    idToken?: string;
    error?: { message?: string };
  };
  if (!res.ok || !body.idToken) {
    throw new Error(
      `Auth emulator token exchange failed: ${body.error?.message ?? res.status}`
    );
  }
  return body.idToken;
}

/** Create (or update) an Auth emulator user and return a fresh ID token. */
export async function createEmulatorUser(
  options: EmulatorUserOptions = {}
): Promise<EmulatorUser> {
  ensureEmulatorAdmin();
  const auth = getAuth();
  const uid =
    options.uid ??
    `e2e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    await auth.createUser({
      uid,
      displayName: options.displayName ?? uid,
    });
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== 'auth/uid-already-exists') {
      throw err;
    }
  }

  if (options.roles && options.roles.length > 0) {
    await auth.setCustomUserClaims(uid, { roles: [...options.roles] });
  }

  const customToken = await auth.createCustomToken(uid);
  const idToken = await exchangeCustomToken(customToken);
  return { uid, idToken };
}

export async function callCallable<TResult>(
  name: string,
  data: unknown,
  idToken?: string
): Promise<TResult> {
  const url = `${FUNCTIONS_EMULATOR_ORIGIN}/${E2E_PROJECT_ID}/us-central1/${name}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data: data ?? null }),
  });

  const body = (await res.json()) as {
    result?: TResult;
    error?: {
      message?: string;
      status?: string;
      code?: number | string;
      details?: unknown;
    };
  };

  if (body.error) {
    const code =
      typeof body.error.status === 'string'
        ? body.error.status
        : typeof body.error.code === 'string'
          ? body.error.code
          : 'UNKNOWN';
    throw new CallableError(
      body.error.message ?? `Callable ${name} failed`,
      code,
      res.status,
      body.error.details
    );
  }

  if (!res.ok) {
    throw new CallableError(
      `Callable ${name} HTTP ${res.status}`,
      'INTERNAL',
      res.status
    );
  }

  return body.result as TResult;
}

function normalizeErrorCode(code: string): string {
  return code.trim().toUpperCase().replace(/-/g, '_');
}

export async function expectCallableError(
  run: () => Promise<unknown>,
  code: string
): Promise<CallableError> {
  const expected = normalizeErrorCode(code);
  try {
    await run();
  } catch (err) {
    if (err instanceof CallableError) {
      const actual = normalizeErrorCode(err.code);
      if (actual !== expected) {
        throw new Error(
          `Expected callable error ${expected}, got ${actual}: ${err.message}`
        );
      }
      return err;
    }
    throw err;
  }
  throw new Error(`Expected callable error ${expected}, but call succeeded`);
}
