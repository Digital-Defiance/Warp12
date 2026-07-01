import { defineString } from 'firebase-functions/params';

/**
 * One-time passphrase for the first admin claim at /admin.
 * Set in functions/.env (see .env.example) — no Secret Manager / Blaze secret API required.
 */
export const bootstrapAdminSecret = defineString('BOOTSTRAP_ADMIN_SECRET');
