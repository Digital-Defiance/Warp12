#!/usr/bin/env bash
# Sync generated iOS icon PNGs into the Xcode AppIcon asset catalog.
# Tauri writes icons to src-tauri/icons/ios/; tauri ios init leaves placeholder
# icons in gen/apple/Assets.xcassets until this runs.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE_DIR="${ROOT}/apps/Warp12"
TAURI_DIR="${BRIDGE_DIR}/src-tauri"
SRC="${TAURI_DIR}/icons/ios"
DEST="${TAURI_DIR}/gen/apple/Assets.xcassets/AppIcon.appiconset"
SOURCE_ICON="${BRIDGE_DIR}/public/W12-1-1.png"
TAURI_BIN="${ROOT}/node_modules/.bin/tauri"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -d "$DEST" ] || die "missing Xcode asset catalog: ${DEST} (run: yarn tauri ios init)"
[ -f "$SOURCE_ICON" ] || die "missing source icon: ${SOURCE_ICON}"

if [ -x "$TAURI_BIN" ] || command -v tauri >/dev/null 2>&1; then
  (cd "$BRIDGE_DIR" && "${TAURI_BIN:-tauri}" icon "$SOURCE_ICON" -o src-tauri/icons) >/dev/null 2>&1
fi

[ -d "$SRC" ] || die "missing generated iOS icons: ${SRC}"

cp "${SRC}"/*.png "$DEST"/
echo "Synced iOS app icons → ${DEST}"
