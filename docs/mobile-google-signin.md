# Google sign-in on web, iOS, Android, and desktop

Warp 12 supports Google sign-in on every target. The web app and the packaged Tauri
apps use **different mechanisms**, because Google refuses OAuth inside embedded webviews
and the Firebase `signInWithPopup`/`signInWithRedirect` helpers do not work in a
`WKWebView`/Android WebView.

| Target | Mechanism | Status |
| --- | --- | --- |
| **Web** (warp12.app) | `signInWithPopup` | Works out of the box |
| **iOS** (Tauri) | System-browser OAuth 2.0 + PKCE → **custom-scheme deep link** → `signInWithCredential` | Needs the setup below |
| **Android** (Tauri) | Same PKCE flow, custom-scheme deep link | Needs the setup below |
| **Desktop** (Tauri: macOS/Windows/Linux) | System-browser OAuth 2.0 + PKCE → **loopback server** → `signInWithCredential` | Needs the setup below |

Everything is gated on the runtime: `isTauriRuntime()` routes any Tauri build through
the native flow; within that, `isTauriMobile()` picks the deep-link path (iOS/Android)
vs. the loopback path (desktop). The plain web build is untouched.

### Why two native paths?

Google validates the `redirect_uri` against the OAuth **client type**:

- **iOS / Android** client types allow **custom-scheme** redirects
  (`com.googleusercontent.apps.NNN-xxxx:/oauth2redirect`), captured by the OS deep link.
- **Desktop** ("installed app") client types do **not** allow custom schemes — only the
  **loopback flow** (`http://127.0.0.1:<port>`). A custom-scheme redirect on a Desktop
  client simply fails and the browser strands you on google.com. So desktop must run a
  temporary localhost server and use it as the redirect target.

## How the flows work

**Mobile (iOS/Android):**

1. Open Google's consent screen in the **system browser** (`tauri-plugin-opener`).
2. Google redirects to a **custom URL scheme** that re-opens the app.
3. `tauri-plugin-deep-link` hands the redirect URL to the web layer, which exchanges the
   authorization code for tokens using **PKCE**.
4. Sign into Firebase with `signInWithCredential(GoogleAuthProvider.credential(idToken))`.

**Desktop (macOS/Windows/Linux):**

1. The web layer calls the Rust command `start_oauth_server`, which binds a one-shot
   localhost server on an ephemeral port and returns that port.
2. Open Google's consent screen in the system browser with
   `redirect_uri=http://127.0.0.1:<port>`.
3. Google redirects the browser to the loopback server; Rust captures the callback URL,
   replies with a "you can close this window" page, and pushes the URL into a channel.
4. The web layer awaits `await_oauth_redirect(port)`, which returns that URL, then
   exchanges the code for tokens (PKCE) and signs into Firebase as above.

The captured URL comes back as a **command return value over a channel** (not a Tauri
event), so it cannot be lost to a listener-registration race — the channel buffers the
value whether the redirect arrives before or after the frontend starts awaiting.

The loopback server is a ~130-line standard-library implementation in
`src-tauri/src/oauth_server.rs` — no third-party OAuth crate.

Implementation: `apps/Warp12/src/firebase/google-oauth-native.ts` +
`auth-actions.ts`. The Rust command is registered in `src-tauri/src/lib.rs`.

## What is already wired in the repo

- JS deps: `@tauri-apps/api`, `@tauri-apps/plugin-opener`, `@tauri-apps/plugin-deep-link`.
- Rust deps + plugin registration: `tauri-plugin-opener`, `tauri-plugin-deep-link`.
- Rust loopback commands: `oauth_server::start_oauth_server` + `await_oauth_redirect` (in
  `src-tauri/src/oauth_server.rs`, registered via `invoke_handler` in `lib.rs`, with an
  `OAuthServers` state via `.manage(...)`). App-defined commands don't need a capability entry.
- Capability permissions: `opener:default`, `deep-link:default`.
- iOS URL scheme placeholder: `src-tauri/Info.ios.plist` → `CFBundleURLTypes`.
- Android intent-filter placeholder: `src-tauri/gen/android/app/src/main/AndroidManifest.xml`.
- Env vars: see `apps/Warp12/.env.example`.

## Steps you need to do

### 1. Create the Google OAuth clients (Google Cloud → APIs & Services → Credentials)

Use the **same GCP project as Firebase** (`warp-12`) so Firebase trusts the tokens.

- **iOS client** — type *iOS*, bundle id `org.digitaldefiance.app.warp12`. Note the client id
  (`NNN-xxxx.apps.googleusercontent.com`) and its **reversed** form
  (`com.googleusercontent.apps.NNN-xxxx`).
- **Desktop client** (serves both **desktop** and **Android**) — type *Desktop app*. This one client
  covers macOS/Windows/Linux (loopback flow) **and** Android (custom-scheme flow), because Desktop
  clients accept both a loopback redirect and the reversed-client-id custom scheme. Desktop clients
  issue a **client secret** (a non-confidential "installed app" secret); set
  `VITE_GOOGLE_DESKTOP_CLIENT_ID` + `VITE_GOOGLE_DESKTOP_CLIENT_SECRET`. The older
  `VITE_GOOGLE_ANDROID_CLIENT_ID`/`_SECRET` names are still accepted as a fallback.
  - **Desktop (macOS/Windows/Linux):** nothing to register — Google auto-permits loopback
    (`http://127.0.0.1:<any-port>`) for Desktop clients. No reversed-scheme edit needed.
  - **Android:** register the Desktop client's reversed id as the intent-filter scheme (step 4).
  - Google's SDK-only *Android* client type does **not** support this custom-scheme code flow, so
    a Desktop client is the simplest path. (A native Credential Manager plugin is a possible future
    enhancement, not wired here.)

> Confirm the exact Android redirect scheme during on-device testing; the code lets you override it
> with `VITE_GOOGLE_OAUTH_REDIRECT_SCHEME_ANDROID` without touching source.

### 2. Let Firebase accept the token audience

Firebase must trust the OAuth client id that appears in the ID token's `aud`. iOS clients created
in the same GCP project are trusted automatically. **Desktop clients are not auto-trusted** — you
must allowlist the Desktop client id (used by both desktop and Android), or sign-in fails at
`signInWithCredential` with `auth/invalid-credential`. Go to **Firebase console → Authentication →
Sign-in method → Google → Web SDK configuration** and add the iOS **and** Desktop client ids to the
allowed client ids.

Android SHA-1 is **not** needed for this flow (the Desktop client is not key-bound).

### 3. Fill in the env vars (`apps/Warp12/.env`)

```
# iOS client (type: iOS)
VITE_GOOGLE_IOS_CLIENT_ID=NNN-xxxx.apps.googleusercontent.com
# Desktop client (type: Desktop app) — serves desktop loopback AND Android
VITE_GOOGLE_DESKTOP_CLIENT_ID=NNN-yyyy.apps.googleusercontent.com
VITE_GOOGLE_DESKTOP_CLIENT_SECRET=GOCSPX-...
# Only if your Android redirect scheme differs from the reversed client id:
# VITE_GOOGLE_OAUTH_REDIRECT_SCHEME_ANDROID=...
```

### 4. Register the redirect scheme in the native projects

Only the **mobile** targets need a scheme registered; **desktop uses loopback and needs no
scheme registration**.

- **iOS** — in `src-tauri/Info.ios.plist`, replace `com.googleusercontent.apps.YOUR_IOS_CLIENT_ID`
  with your iOS client's reversed id.
- **Android** — `yarn tauri:android:dev` / `yarn build:android` run
  `scripts/inject-android-manifest.sh`, which reads `apps/Warp12/.env` and patches
  `gen/android/app/src/main/AndroidManifest.xml` with the OAuth redirect scheme
  (`VITE_GOOGLE_OAUTH_REDIRECT_SCHEME_ANDROID`, or the reversed
  `VITE_GOOGLE_DESKTOP_CLIENT_ID` / `VITE_GOOGLE_ANDROID_CLIENT_ID`). Environment
  variables override `.env` for CI.

Both must match the reversed form of the corresponding client id (or your override env).

### 5. Build & run

```bash
yarn install
yarn tauri:ios:dev       # or tauri:ios:build
yarn tauri:android:dev   # or tauri:android:build
yarn tauri:dev           # desktop (macOS/Windows/Linux) — loopback works in dev too
```

If you regenerate the native projects (`tauri ios init` / `tauri android init`), re-apply the
plist / manifest scheme edits (they live in generated files).

> **Desktop note:** unlike the earlier deep-link approach, the loopback flow works in `tauri dev`
> — it does **not** require a bundled `.app`.

## Testing checklist

- **Web:** popup sign-in still works (unchanged).
- **iOS/Android:** tapping **Sign in with Google** opens Safari/Chrome, you pick an account, the app
  re-opens and shows you signed in.
- **Desktop:** tapping **Sign in with Google** opens the default browser, you pick an account, the
  browser shows "Signed in to Warp 12 — you can close this window," and the app shows you signed in.
- Guest ("Continue as guest") continues to work on all targets and is unaffected.

## Troubleshooting

- **Desktop: after picking an account the browser lands on google.com and nothing happens:** you're
  using a custom-scheme redirect on a Desktop client, which Google rejects. This is fixed by the
  loopback flow — make sure you're on a build that includes `start_oauth_server` and that the desktop
  path (`isTauriMobile()` false) is taken.
- **Mobile: browser opens but the app never comes back:** the redirect scheme in the plist/manifest
  does not match the client id (or the deep-link plugin isn't registered). Verify the reversed id
  matches exactly.
- **`auth/invalid-credential` (audience):** add the client id to Firebase → Google provider allowed
  client ids (step 2). Desktop clients are **not** auto-trusted, so this is required for desktop/Android.
- **Android `invalid_client` / `redirect_uri_mismatch`:** you likely used the SDK-only *Android* client
  type; switch to a **Desktop** client (step 1) and set the secret.
- **Desktop: "address already in use" / server won't start:** rare, since the server binds an
  ephemeral port (`127.0.0.1:0`); retry the sign-in.
- **Nothing happens on tap:** confirm `opener:default` and `deep-link:default` are in
  `capabilities/default.json` and the Rust commands are registered via `invoke_handler` in `lib.rs`.
- **Desktop: browser shows the success page but the app never signs in:** the `code` was
  captured but the app didn't receive it. Ensure you rebuilt the Rust side (both
  `start_oauth_server` and `await_oauth_redirect` must be registered) — a stale binary that
  still uses the event mechanism can drop the callback.
