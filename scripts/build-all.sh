#!/bin/bash
# Full release pipeline: bump version (optional), then macOS / App Store / iOS / Android.
#
# Usage:
#   ./scripts/build-all.sh 0.7.51
#   ./scripts/build-all.sh --next-build
#   ./scripts/build-all.sh --next-minor --next-build
#
# Version scheme: 0.{minor}.{build} where build is iOS bundleVersion and Android
# versionCode (Windows/macOS use tauri.conf.json "version").
#
# Secrets for GUI/CI (env only — never on argv / shell history):
#   APPLE_PASSWORD, APPLE_IOS_CERTIFICATE_PASSWORD, ANDROID_KEYSTORE_PASSWORD
#   NONINTERACTIVE=1, WARP12_PUSH_HOMEBREW_TAP=0
#   See vendor/warp12-release-head SwiftUI launcher.

set -e

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load macos
warp_env_cd_root
ROOT="$WARP12_ROOT"

NEXT_BUILD=0
NEXT_MINOR=0
EXPLICIT_VERSION=""
PUSH_TAP=1
PUSH_GIT_TAG=1

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
usage:
  ./scripts/build-all.sh <0.minor.build>
  ./scripts/build-all.sh --next-build
  ./scripts/build-all.sh --next-minor
  ./scripts/build-all.sh --next-minor --next-build

Examples:
  ./scripts/build-all.sh --next-build
    0.6.51 → 0.6.52 (bundleVersion / versionCode 52)

  ./scripts/build-all.sh --next-minor --next-build

  ./scripts/build-all.sh --no-push-tap
  ./scripts/build-all.sh --no-push-tag

Version is written to apps/Warp12/package.json, src-tauri/tauri.conf.json,
and src-tauri/Cargo.toml before building.

NONINTERACTIVE=1 skips macOS publish [y/N] prompts (Release Head sets this).
WARP12_PUSH_HOMEBREW_TAP=0 commits homebrew-tap locally without pushing.
EOF
  exit 1
}

while [ $# -gt 0 ]; do
  case "$1" in
    --next-build)
      NEXT_BUILD=1
      shift
      ;;
    --next-minor)
      NEXT_MINOR=1
      shift
      ;;
    --no-push-tap)
      PUSH_TAP=0
      shift
      ;;
    --no-push-tag)
      PUSH_GIT_TAG=0
      shift
      ;;
    -h|--help)
      usage
      ;;
    --)
      shift
      break
      ;;
    -*)
      die "unknown option: $1 (try --help)"
      ;;
    *)
      if [ -n "$EXPLICIT_VERSION" ]; then
        die "too many version arguments"
      fi
      EXPLICIT_VERSION="$1"
      shift
      ;;
  esac
done

if [ "$NEXT_BUILD" = 1 ] || [ "$NEXT_MINOR" = 1 ]; then
  BUMP_ARGS=()
  [ "$NEXT_MINOR" = 1 ] && BUMP_ARGS+=(--next-minor)
  [ "$NEXT_BUILD" = 1 ] && BUMP_ARGS+=(--next-build)
  node "${ROOT}/scripts/app-version.mjs" bump "${BUMP_ARGS[@]}"
elif [ -n "$EXPLICIT_VERSION" ]; then
  node "${ROOT}/scripts/app-version.mjs" set "$EXPLICIT_VERSION"
else
  usage
fi

VERSION="$(node "${ROOT}/scripts/app-version.mjs" print)"
echo "Building version ${VERSION}"
MACOS_ARGS=("$VERSION" --publish)
[ "$PUSH_TAP" = 1 ] && MACOS_ARGS+=(--push-tap)
[ "$PUSH_GIT_TAG" = 1 ] || MACOS_ARGS+=(--no-push-tag)
./scripts/build-macos.sh "${MACOS_ARGS[@]}"
./scripts/build-macos-appstore.sh "$VERSION" --upload
./scripts/build-ios-appstore.sh --upload
./scripts/build-android.sh
