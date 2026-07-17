#!/usr/bin/env bash
# Regenerate Android launcher icons from the Bridge source PNG.
#
# Current @tauri-apps/cli writes Android PNGs directly into
#   src-tauri/gen/android/app/src/main/res/mipmap-*/
# The legacy src-tauri/icons/android/ tree is NOT updated and must not be
# copied over gen/ (that reverts to a stale icon — same bug as iOS).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE_DIR="${ROOT}/apps/Warp12"
DEST="${BRIDGE_DIR}/src-tauri/gen/android/app/src/main/res"
SOURCE_ICON="${BRIDGE_DIR}/public/W-1-1.png"
TAURI_BIN="${ROOT}/node_modules/.bin/tauri"
LEGACY_ANDROID_ICONS="${BRIDGE_DIR}/src-tauri/icons/android"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -d "$DEST" ] || die "missing Android res/: ${DEST} (run: yarn tauri android init)"
[ -f "$SOURCE_ICON" ] || die "missing source icon: ${SOURCE_ICON}"
[ -x "$TAURI_BIN" ] || die "missing tauri CLI at ${TAURI_BIN}"

(cd "$BRIDGE_DIR" && "$TAURI_BIN" icon "$SOURCE_ICON" -o src-tauri/icons)

[ -f "${DEST}/mipmap-xxxhdpi/ic_launcher.png" ] || die "tauri icon did not write ${DEST}/mipmap-xxxhdpi/ic_launcher.png"

# Keep icons/android in sync for docs/tools that still look there — never the reverse.
if [ -d "$LEGACY_ANDROID_ICONS" ]; then
  for dir in "${DEST}"/mipmap-*; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    mkdir -p "${LEGACY_ANDROID_ICONS}/${name}"
    cp "${dir}"/* "${LEGACY_ANDROID_ICONS}/${name}/"
  done
  if [ -f "${DEST}/values/ic_launcher_background.xml" ]; then
    mkdir -p "${LEGACY_ANDROID_ICONS}/values"
    cp "${DEST}/values/ic_launcher_background.xml" "${LEGACY_ANDROID_ICONS}/values/"
  fi
fi

echo "Synced Android app icons → ${DEST}"
echo "Source: ${SOURCE_ICON}"
