# Warp Ops

Fleet administration console for Warp online services (Firebase project `warp-12`).

## Surfaces

| Surface | Command | URL / artifact |
|---------|---------|----------------|
| Web (dev) | `yarn serve:ops` | http://localhost:4220 |
| Web (prod) | `yarn deploy:hosting:ops` | https://ops.iwdf.org |
| Desktop | `yarn tauri:ops:dev` / `yarn tauri:ops:build` | Warp Ops.app |

The SPA and Tauri shell share the same Vite frontend (`apps/WarpOps`). Firebase env is read from `apps/Warp12/.env` (`VITE_FIREBASE_*`).

### Desktop Google sign-in

The macOS/Windows app cannot use Firebase `signInWithPopup` (WKWebView). It uses the same **system browser + localhost loopback** flow as The Bridge:

1. Requires `VITE_GOOGLE_DESKTOP_CLIENT_ID` and `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` in `apps/Warp12/.env` (already used by Bridge).
2. Google Cloud Desktop OAuth client must allow loopback redirects (`http://127.0.0.1` — Google accepts any port for Desktop clients).
3. After rebuild, **Sign in with Google** opens the system browser; when done, return to Warp Ops.

Web (ops.iwdf.org) still uses the popup flow.

## Access

Google sign-in required. The account must have the Firebase Auth custom claim `roles` including `admin` or `moderator` (same claims as Bridge / leaderboard tools). Non-ops accounts see a refusal screen after sign-in. Moderators get mute/kick/reports/audit; full admins also get bans, TEI mutation, hard deletes, and season tools.

## First deploy (ops.iwdf.org)

1. Create the Hosting site (once):

   ```bash
   firebase hosting:sites:create warp-12-ops --project warp-12
   ```

2. Deploy:

   ```bash
   yarn deploy:hosting:ops
   ```

3. In Firebase Console → Hosting → `warp-12-ops` → add custom domain `ops.iwdf.org`.

4. Ensure `ops.iwdf.org` is listed under Authentication → Settings → Authorized domains (and in `firebase.json` `authorizedRedirectUris`).

5. Deploy ban Functions + Firestore rules if not already live:

   ```bash
   yarn deploy:firestore
   yarn deploy:functions
   ```

## CLI companion

```bash
yarn warp ban <uid> --reason "…"
yarn warp ban-list
```
