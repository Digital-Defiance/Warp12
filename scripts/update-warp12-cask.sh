#!/usr/bin/env bash
# Update Homebrew cask version + sha256 after a GitHub DMG release.
#
# Usage:
#   bash scripts/update-warp12-cask.sh <version> <sha256>
#   HOMEBREW_TAP_DIR=~/path/to/tap bash scripts/update-warp12-cask.sh 0.2.0 <sha256>

set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load publish
warp_env_validate publish
warp_env_cd_root

VERSION="${1:-}"
SHA256="${2:-}"
HOMEBREW_TAP_DIR="${HOMEBREW_TAP_DIR}"
GITHUB_REPO="${GITHUB_REPO}"
CASK_PATH="${CASK_PATH:-${HOMEBREW_TAP_DIR}/Casks/warp12.rb}"
# Ruby cask interpolation (#{version}), not shell ${version} — Homebrew rejects the latter as a bad URI.
DMG_ASSET='Warp_12_#{version}_universal.dmg'

die() {
  echo "error: $*" >&2
  exit 1
}

[ -n "$VERSION" ] || die "usage: bash scripts/update-warp12-cask.sh <version> <sha256>"
[ -n "$SHA256" ] || die "usage: bash scripts/update-warp12-cask.sh <version> <sha256>"
[ -f "$CASK_PATH" ] || die "missing cask: ${CASK_PATH} (set HOMEBREW_TAP_DIR / CASK_PATH)"

# BSD vs GNU sed -i
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(sed -i)
else
  SED_INPLACE=(sed -i '')
fi

"${SED_INPLACE[@]}" "s|^  version .*|  version \"${VERSION}\"|" "$CASK_PATH"
"${SED_INPLACE[@]}" "s|^  sha256 .*|  sha256 \"${SHA256}\"|" "$CASK_PATH"
"${SED_INPLACE[@]}" "s|^  url .*|  url \"https://github.com/${GITHUB_REPO}/releases/download/v#{version}/${DMG_ASSET}\"|" "$CASK_PATH"

echo "Updated ${CASK_PATH}"
echo "  version ${VERSION}"
echo "  sha256  ${SHA256}"
echo "  repo    ${GITHUB_REPO}"
