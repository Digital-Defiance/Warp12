import admin from 'firebase-admin';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/bootstrap-admin-claims.mjs <email>');
  process.exit(1);
}

admin.initializeApp({ projectId: 'warp-12' });

const user = await admin.auth().getUserByEmail(email);
await admin.auth().setCustomUserClaims(user.uid, {
  roles: ['admin', 'match_official'],
});
const updated = await admin.auth().getUserByEmail(email);
console.log(
  JSON.stringify(
    {
      ok: true,
      uid: updated.uid,
      email: updated.email,
      roles: updated.customClaims?.roles,
    },
    null,
    2
  )
);
