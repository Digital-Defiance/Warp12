# Rated matches (officiated TEI)

Human-pool TEI for **offline / in-person** domino is applied only through **approved rated matches** on [leaderboard.warp12.app](https://leaderboard.warp12.app).

## Flow

1. **Match official** (role: `match_official`) creates a match → receives code e.g. `MT-7K3Q`
2. **Captains** sign in with Google at `/matches` and check in with the code
3. After play, the **official** enters standings at `/officiate/{code}`
4. **Official approves** → Cloud Function applies human-pool TEI server-side

Practice vs AI TEI still uses the `reportPracticeAiMatch` callable (reference-AI buckets).

## Roles

| Role | Set via | Capabilities |
|------|---------|--------------|
| `admin` | `bootstrapAdmin` (one-time secret) or `setUserRoles` | Grant roles |
| `match_official` | `setUserRoles` | Create matches, submit standings, approve |

Roles live in **Firebase Auth custom claims** — never in client-writable Firestore fields.

## Bootstrap first admin

1. Deploy Cloud Functions with env `BOOTSTRAP_ADMIN_SECRET`
2. Sign in at `leaderboard.warp12.app/admin` with Google
3. Enter the secret → **Claim admin**
4. Grant `match_official` to tournament directors via uid

## Deploy

```bash
# Set bootstrap secret on the function (Firebase console or CLI)
firebase functions:secrets:set BOOTSTRAP_ADMIN_SECRET --project warp-12

yarn deploy:functions
yarn deploy:firestore
yarn deploy:hosting:leaderboard
```

## Firestore

- `ratedMatches/{matchCode}` — read-only to clients; writes via Admin SDK (Functions)
- `playerStats/{uid}` — clients cannot mutate `humanTei`, `humanRatedGameIds`, or `localAi`

## Bridge integration

After any completed campaign, the bridge links to leaderboard check-in. Captains use the **official's match code**, not the online sector code.
