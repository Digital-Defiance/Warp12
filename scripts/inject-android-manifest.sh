#!/usr/bin/env bash
# Patch generated AndroidManifest.xml after `tauri android init` regen:
#   - portrait orientation (phone layout)
#   - Google OAuth redirect scheme from apps/Warp12/.env

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/apps/Warp12/.env"
MANIFEST="${ROOT}/apps/Warp12/src-tauri/gen/android/app/src/main/AndroidManifest.xml"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -f "$MANIFEST" ] || die "missing ${MANIFEST} — run: yarn tauri android init (from apps/Warp12)"

python3 - "$ENV_FILE" "$MANIFEST" <<'PY'
import os
import re
import sys
from pathlib import Path

env_file = Path(sys.argv[1])
manifest_path = Path(sys.argv[2])

def load_env_file(path):
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        if "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            values[key] = value
    return values

def reversed_client_id_scheme(client_id):
    bare = client_id.removesuffix(".apps.googleusercontent.com")
    return f"com.googleusercontent.apps.{bare}"

def resolve_android_oauth_scheme(env):
    override = env.get("VITE_GOOGLE_OAUTH_REDIRECT_SCHEME_ANDROID")
    if override:
        return override
    client_id = env.get("VITE_GOOGLE_DESKTOP_CLIENT_ID") or env.get(
        "VITE_GOOGLE_ANDROID_CLIENT_ID"
    )
    if not client_id:
        return None
    return reversed_client_id_scheme(client_id)

env = load_env_file(env_file)
for key in (
    "VITE_GOOGLE_OAUTH_REDIRECT_SCHEME_ANDROID",
    "VITE_GOOGLE_DESKTOP_CLIENT_ID",
    "VITE_GOOGLE_ANDROID_CLIENT_ID",
):
    if key in os.environ and os.environ[key]:
        env[key] = os.environ[key]

content = manifest_path.read_text(encoding="utf-8")
updated = content

updated = re.sub(
    r'android:screenOrientation="sensorLandscape"',
    'android:screenOrientation="userPortrait"',
    updated,
)
updated = re.sub(
    r'android:screenOrientation="landscape"',
    'android:screenOrientation="userPortrait"',
    updated,
)

scheme = resolve_android_oauth_scheme(env)
if scheme:
    scheme_pattern = re.compile(r'android:scheme="com\.googleusercontent\.apps\.[^"]*"')
    if not scheme_pattern.search(updated):
        print(
            "warning: AndroidManifest has no com.googleusercontent.apps.* scheme to patch",
            file=sys.stderr,
        )
    else:
        updated = scheme_pattern.sub(f'android:scheme="{scheme}"', updated, count=1)
else:
    print(
        "warning: Google Android OAuth scheme not configured — set "
        "VITE_GOOGLE_DESKTOP_CLIENT_ID (or VITE_GOOGLE_ANDROID_CLIENT_ID) "
        f"in {env_file} or the environment",
        file=sys.stderr,
    )

if updated == content:
    print(f"AndroidManifest already up to date: {manifest_path}")
else:
    manifest_path.write_text(updated, encoding="utf-8")
    if scheme:
        print(f"Patched AndroidManifest (portrait + OAuth scheme {scheme}): {manifest_path}")
    else:
        print(f"Patched AndroidManifest (portrait): {manifest_path}")
PY
