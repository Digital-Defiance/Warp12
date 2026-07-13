# Troubleshooting Android Google Sign-In

## Symptom

After completing Google OAuth in the browser, the app returns but sits on "Signing in..." indefinitely.

## Root Cause

The deep link redirect from Google isn't being received or processed correctly.

## Diagnostic Steps

### 1. Check Console Logs

With the Android device connected via USB:

```bash
# Filter for OAuth logs
adb logcat | grep -i oauth

# Or look at all app logs
adb logcat | grep -i warp
```

Look for `[oauth]` log lines - I've added detailed logging to trace the flow.

### 2. Verify the Redirect Scheme

The scheme in `AndroidManifest.xml` MUST match what Google is configured to redirect to:

```bash
# Check what's in the manifest
cat apps/Warp12/src-tauri/gen/android/app/src/main/AndroidManifest.xml | grep -A5 "intent-filter"
```

Should show:
```xml
<data android:scheme="com.googleusercontent.apps.527330456110-u12uqgjhpuo905sp5iu8rhibr8npiubg" />
```

This must match your `VITE_GOOGLE_DESKTOP_CLIENT_ID` (reversed).

### 3. Rebuild with Fresh Manifest

```bash
# Regenerate manifest with correct scheme
yarn tauri:android:build

# Or just dev mode
yarn tauri:android:dev
```

The `inject-android-manifest.sh` script runs automatically.

## Common Issues

### Issue 1: Wrong Client ID in Manifest

**Symptom:** Deep link never arrives, app stays on "Signing in..."

**Fix:**
1. Check `.env` file has correct `VITE_GOOGLE_DESKTOP_CLIENT_ID`
2. Rebuild: `yarn tauri:android:build`
3. Verify manifest was patched correctly

### Issue 2: Google Console Misconfigured

**Symptom:** Google shows "redirect_uri_mismatch" error

**Fix:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your Desktop/installed client
3. Ensure redirect URI includes: `com.googleusercontent.apps.YOUR-CLIENT-ID:/oauth2redirect`
4. Note: Use the DESKTOP client ID (not Android client ID)

### Issue 3: Deep Link Plugin Not Registered

**Symptom:** No `[oauth]` logs appear, or getCurrent() throws error

**Fix:**
Check that `@tauri-apps/plugin-deep-link` is in `tauri.conf.json`:
```json
{
  "plugins": {
    "deep-link": {}
  }
}
```

Then rebuild.

### Issue 4: State Mismatch

**Symptom:** Logs show "URL matched scheme but no valid code"

**Cause:** The `state` parameter in the redirect doesn't match what we sent.

**Fix:** This usually means Google cached an old auth request. Clear Google account cache on the device:
- Settings → Apps → Google → Storage → Clear Cache
- Try sign-in again

## Expected Flow

When working correctly, you'll see these logs:

```
[oauth] runNativeGoogleOAuth { platform: 'android', mobile: true }
[oauth] resolved client config { clientIdSuffix: '...', hasClientSecret: true }
[oauth] awaitRedirectCode: waiting for deep link event
[System browser opens]
[User completes Google sign-in]
[oauth] awaitRedirectCode: deep link event received
[oauth] awaitRedirectCode: checking URLs { count: 1, schemes: ['com.googleusercontent.apps.527330456110-u12uqgjhpuo905sp5iu8rhibr8npiubg'] }
[oauth] awaitRedirectCode: code extracted successfully
[oauth] token exchange: POST
[oauth] token exchange: response { status: 200, ok: true }
[oauth] token exchange: id_token received
[oauth] runNativeGoogleOAuth: tokens obtained
```

## Quick Fix Script

```bash
# Clean rebuild with correct manifest
cd /Volumes/Code/Warp12
yarn build:android
```

This ensures everything is fresh and the manifest is correctly patched.

## Still Not Working?

If the issue persists after these steps:

1. **Check adb logcat output** - paste the `[oauth]` logs
2. **Verify Google Console settings** - screenshot the OAuth client redirect URIs
3. **Check the .env file** - ensure `VITE_GOOGLE_DESKTOP_CLIENT_ID` is set

The enhanced logging I just added should show exactly where the flow is breaking.
