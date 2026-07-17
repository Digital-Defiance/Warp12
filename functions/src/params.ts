import { defineString } from 'firebase-functions/params';

/**
 * One-time passphrase for the first admin claim at /admin.
 * Set in functions/.env (see .env.example) — no Secret Manager / Blaze secret API required.
 */
export const bootstrapAdminSecret = defineString('BOOTSTRAP_ADMIN_SECRET');

/**
 * HMAC secret for match certificate signatures (JSON + PDF).
 * Set in functions/.env as CERTIFICATE_SIGNING_SECRET.
 */
export const certificateSigningSecret = defineString('CERTIFICATE_SIGNING_SECRET');
