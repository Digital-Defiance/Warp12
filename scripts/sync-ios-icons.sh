#!/usr/bin/env bash
# Regenerate iOS AppIcon assets from the Bridge source PNG.
#
# Current @tauri-apps/cli writes iOS PNGs directly into
#   src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/
# The legacy src-tauri/icons/ios/ tree is NOT updated and must not be copied
# over the asset catalog (that reverts to a stale icon).

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE_DIR="${ROOT}/apps/Warp12"
DEST="${BRIDGE_DIR}/src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset"
SOURCE_ICON="${BRIDGE_DIR}/public/W-1-1.png"
TAURI_BIN="${ROOT}/node_modules/.bin/tauri"
LEGACY_IOS_ICONS="${BRIDGE_DIR}/src-tauri/icons/ios"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -d "$DEST" ] || die "missing Xcode asset catalog: ${DEST} (run: yarn tauri ios init)"
[ -f "$SOURCE_ICON" ] || die "missing source icon: ${SOURCE_ICON}"
[ -x "$TAURI_BIN" ] || die "missing tauri CLI at ${TAURI_BIN}"

(cd "$BRIDGE_DIR" && "$TAURI_BIN" icon "$SOURCE_ICON" -o src-tauri/icons)

[ -f "${DEST}/AppIcon-512@2x.png" ] || die "tauri icon did not write ${DEST}/AppIcon-512@2x.png"

# Keep icons/ios in sync for docs/tools that still look there — never the reverse.
if [ -d "$LEGACY_IOS_ICONS" ]; then
  cp "${DEST}"/*.png "${LEGACY_IOS_ICONS}/"
fi

echo "Synced iOS app icons → ${DEST}"
echo "Source: ${SOURCE_ICON}"
