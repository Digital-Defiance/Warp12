#!/usr/bin/env bash
# Sync generated Android launcher icons into the Gradle res/ tree.
# Tauri writes icons to src-tauri/icons/android/; tauri android init leaves
# placeholder icons in gen/android/app/src/main/res/ until this runs.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BRIDGE_DIR="${ROOT}/apps/Warp12"
TAURI_DIR="${BRIDGE_DIR}/src-tauri"
SRC="${TAURI_DIR}/icons/android"
DEST="${TAURI_DIR}/gen/android/app/src/main/res"
SOURCE_ICON="${BRIDGE_DIR}/public/W12-1-1.png"
TAURI_BIN="${ROOT}/node_modules/.bin/tauri"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -d "$DEST" ] || die "missing Android res/: ${DEST} (run: yarn tauri android init)"
[ -f "$SOURCE_ICON" ] || die "missing source icon: ${SOURCE_ICON}"

if [ -x "$TAURI_BIN" ] || command -v tauri >/dev/null 2>&1; then
  (cd "$BRIDGE_DIR" && "${TAURI_BIN:-tauri}" icon "$SOURCE_ICON" -o src-tauri/icons) >/dev/null 2>&1
fi

[ -d "$SRC" ] || die "missing generated Android icons: ${SRC}"

for dir in "${SRC}"/mipmap-*; do
  [ -d "$dir" ] || continue
  name="$(basename "$dir")"
  mkdir -p "${DEST}/${name}"
  cp "${dir}"/* "${DEST}/${name}/"
done

if [ -f "${SRC}/values/ic_launcher_background.xml" ]; then
  mkdir -p "${DEST}/values"
  cp "${SRC}/values/ic_launcher_background.xml" "${DEST}/values/"
fi

echo "Synced Android app icons → ${DEST}"
