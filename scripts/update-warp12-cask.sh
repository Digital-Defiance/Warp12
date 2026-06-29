#!/usr/bin/env bash
# Update digital-defiance/homebrew-tap Casks/warp12.rb (version + sha256).
#
# Cask token: warp12. DMG/app: Warp 12 (productName in tauri.conf.json).
# GitHub releases: Digital-Defiance/Warp12
#
# Usage:
#   bash scripts/update-warp12-cask.sh 0.2.0 <sha256>
#   HOMEBREW_TAP_DIR=~/Code/homebrew-tap bash scripts/update-warp12-cask.sh 0.2.0 <sha256>

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-}"
SHA256="${2:-}"
HOMEBREW_TAP_DIR="${HOMEBREW_TAP_DIR:-${HOME}/Code/homebrew-tap}"
GITHUB_REPO="${GITHUB_REPO:-Digital-Defiance/Warp12}"
CASK_PATH="${CASK_PATH:-${HOMEBREW_TAP_DIR}/Casks/warp12.rb}"
CASK_EXAMPLE="${ROOT}/scripts/Casks/warp12.rb.example"
TAURI_CONF="${ROOT}/apps/Warp12/src-tauri/tauri.conf.json"
APP_BUNDLE='Warp 12.app'

die() {
  echo "error: $*" >&2
  exit 1
}

[[ -n "$VERSION" ]] || die "usage: $0 <version> <sha256>  (e.g. 0.2.0 abc123...)"
[[ -n "$SHA256" ]] || die "missing sha256"

if [[ ! -f "$CASK_PATH" ]]; then
  [[ -f "$CASK_EXAMPLE" ]] || die "cask not found: ${CASK_PATH} (missing ${CASK_EXAMPLE})"
  mkdir -p "$(dirname "$CASK_PATH")"
  cp "$CASK_EXAMPLE" "$CASK_PATH"
  echo "Created ${CASK_PATH} from example." >&2
fi

[[ -f "$TAURI_CONF" ]] || die "missing ${TAURI_CONF}"

PRODUCT_NAME="$(node -e "
  const j = require(process.argv[1]);
  process.stdout.write(String(j.productName || 'Warp 12'));
" "$TAURI_CONF")"

# Normalize tag-style versions for the cask (no leading v).
VERSION="$(printf '%s' "$VERSION" | sed 's/^v//')"

DMG_ASSET="${PRODUCT_NAME}_#{version}_universal.dmg"
# Homebrew/curl: spaces in release asset URLs are encoded as %20.
DMG_URL_ASSET="$(printf '%s' "$DMG_ASSET" | sed 's/ /%20/g')"

if [ "$(uname -s)" = "Darwin" ]; then
  SED_INPLACE=(sed -i '')
else
  SED_INPLACE=(sed -i)
fi

"${SED_INPLACE[@]}" "s/^  version .*/  version \"${VERSION}\"/" "$CASK_PATH"
"${SED_INPLACE[@]}" "s/^  sha256 .*/  sha256 \"${SHA256}\"/" "$CASK_PATH"

# Universal DMG — do not restrict to Apple Silicon only.
"${SED_INPLACE[@]}" '/depends_on arch: :arm64/d' "$CASK_PATH"

"${SED_INPLACE[@]}" "s|^  url .*|  url \"https://github.com/${GITHUB_REPO}/releases/download/v#{version}/${DMG_URL_ASSET}\"|" "$CASK_PATH"

if ! grep -q "app \"${APP_BUNDLE}\"" "$CASK_PATH"; then
  "${SED_INPLACE[@]}" 's/^  app .*/  app "'"${APP_BUNDLE}"'"/' "$CASK_PATH"
fi

echo "Updated ${CASK_PATH}"
echo "  version ${VERSION}"
echo "  sha256 ${SHA256}"
echo "  dmg ${DMG_ASSET}"
echo "  app ${APP_BUNDLE}"
