# Rated matches (officiated TEI)

Human-pool and **crew** TEI for **offline / in-person** domino is applied through **approved rated matches** on [leaderboard.warp12.app](https://leaderboard.warp12.app).

## Flow

1. **Match official** (role: `match_official`) creates a match → receives code e.g. `MT-7K3Q`
2. **Captains** sign in with Google at `/matches` and check in with the code
3. After play, the **official** enters standings at `/officiate/{code}`
4. **Official approves** → Cloud Function applies TEI server-side

Practice vs AI TEI still uses the `reportPracticeAiMatch` callable (reference-AI buckets).

## Crew-rated matches

When the official selects a **crew charter** at `/officiate`:

1. Match objective, fleet size, and campaign length are **locked** to the charter.
2. Checked-in captains must be **members** of that crew (join via invite link first).
3. On approval, TEI updates **`groupTei[charterId]`** — not global `humanTei`, unless the charter is **Global Official** (updates both).

See [Crews & charters](./crews-roadmap.md) for membership, invites, and online sector parity.

## Roles

| Role | Set via | Capabilities |
|------|---------|--------------|
| `admin` | `bootstrapAdmin` (one-time secret) or `setUserRoles` | Grant roles |
| `match_official` | `setUserRoles` | Create matches, submit standings, approve |

Roles live in **Firebase Auth custom claims** — never in client-writable Firestore fields.

## Bootstrap first admin

This is a **one-time chicken-and-egg fix**: nobody has `admin` yet, so the first admin proves they know a server-side secret you configured at deploy time.

### What happens under the hood

1. You pick a long random passphrase (e.g. `openssl rand -base64 32`) — **only you** know it.
2. You store it as Firebase secret `BOOTSTRAP_ADMIN_SECRET` and redeploy functions.
3. At [leaderboard.warp12.app/admin](https://leaderboard.warp12.app/admin), you sign in with **Google** (not guest).
4. You paste the passphrase and click **Claim admin**.
5. The `bootstrapAdmin` Cloud Function checks the passphrase, then sets on **your Google account's Firebase uid**:

   ```json
   { "roles": ["admin"] }
   ```

   That lives in **Auth custom claims**, not Firestore — clients cannot forge it.

6. The page refreshes your ID token; the **Grant roles** panel appears.

7. Grant yourself `match_official` (paste your uid — same account you just bootstrapped) so you can create/approve matches at `/officiate`.

After that, use **Grant roles** for other officials; bootstrap is only for the first admin.

### Commands (in order)

**Note:** Cloud Functions require the Firebase **Blaze** plan (pay-as-you-go). Hosting + Firestore rules work on Spark; rated-match **Functions do not**. Upgrade: [Firebase pricing](https://firebase.google.com/pricing) → Blaze (you only pay if usage exceeds free tiers).

We use a **`.env` file** for the bootstrap passphrase — **not** `firebase functions:secrets:set` (that needs Secret Manager + Blaze secret API).

```bash
# 1. Choose a secret
openssl rand -base64 32

# 2. Put it in functions/.env (never commit this file)
cp functions/.env.example functions/.env
# Edit functions/.env → BOOTSTRAP_ADMIN_SECRET=<paste secret>

# 3. Deploy (requires Blaze)
yarn deploy:functions
yarn deploy:firestore
yarn deploy:hosting:leaderboard
```

### UI walkthrough

| Step | Where | Action |
|------|--------|--------|
| 1 | `/admin` | Continue with **Google** |
| 2 | Bootstrap panel | Enter secret → **Claim admin** |
| 3 | Grant roles panel | Your uid + check `match_official` → **Save roles** |
| 4 | `/officiate` | Create a match code |

**Finding your uid:** Firebase Console → Authentication → Users → click your Google user → copy User UID. Or temporarily log it from browser devtools after sign-in (`auth.currentUser.uid`).

### Common failures

| Error | Cause |
|-------|--------|
| `Invalid bootstrap secret` | `functions/.env` missing/wrong, or functions not redeployed after editing `.env` |
| `Rated matches require a signed-in account` | Still on guest — use Google on `/admin` |
| Grant roles panel never appears | Token stale — sign out/in, or hard refresh after claim |
| `Admin role required` on setUserRoles | Bootstrap didn't succeed — check secret + redeploy |

### Security note

Anyone who knows `BOOTSTRAP_ADMIN_SECRET` can claim admin **until you rotate or remove the secret's usefulness**. After you're admin, consider setting the secret to a new value (or revoking access) so the bootstrap door isn't left wide open. There is no "disable bootstrap" flag yet — rotating the secret is the practical mitigation.

## Firestore

- `ratedMatches/{matchCode}` — read-only to clients; writes via Admin SDK (Functions); optional `charterId`, `rulesProfileId`, `playerCount`
- `charters/{charterId}` — read-only to clients; writes via Functions
- `charterMembers/{charterId}_{uid}` — read own membership only
- `playerStats/{uid}` — clients cannot mutate `humanTei`, `humanRatedGameIds`, `groupTei`, `groupRatedIds`, or `localAi`

## Bridge integration

After any completed campaign, the bridge links to leaderboard check-in. Captains use the **official's match code**, not the online sector code.
