import admin from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/bootstrap-admin-claims.mjs <email>');
  process.exit(1);
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  for (const raw of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    process.env[key] = value;
  }
}

loadDotEnv(join(root, '.env'));
loadDotEnv(join(root, '.env.local'));

const projectId = process.env.FIREBASE_PROJECT;
if (!projectId) {
  console.error(
    'error: FIREBASE_PROJECT is required (set in process ENV or repo-root .env — see .env.example)',
  );
  process.exit(1);
}

admin.initializeApp({ projectId });

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, {
  roles: ['admin', 'match_official'],
});
const updated = await admin.auth().getUserByEmail(email);
console.log(
  JSON.stringify(
    {
      ok: true,
      projectId,
      uid: updated.uid,
      email: updated.email,
      roles: updated.customClaims?.roles,
    },
    null,
    2
  )
);
