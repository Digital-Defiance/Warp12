#!/usr/bin/env bash
# Gradle/Xcode invoke `node tauri …` from src-tauri (Android) or gen/apple (iOS).
# Yarn hoists the CLI to repo-root node_modules — these symlinks bridge that gap.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TAURI_CLI="${ROOT}/node_modules/@tauri-apps/cli/tauri.js"
TAURI_DIR="${ROOT}/apps/Warp12/src-tauri"
APPLE_DIR="${TAURI_DIR}/gen/apple"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -f "$TAURI_CLI" ] || die "tauri CLI not found at ${TAURI_CLI} — run yarn install from repo root"

link_tauri() {
  local dir="$1"
  local rel="$2"
  local link="${dir}/tauri"
  mkdir -p "$dir"
  ln -sf "$rel" "$link"
}

# Android Gradle: workingDir = src-tauri (rootDirRel ../../../ from app/)
link_tauri "$TAURI_DIR" "../../../node_modules/@tauri-apps/cli/tauri.js"

# iOS Xcode: build-rust-code.sh runs from gen/apple/
if [ -d "$APPLE_DIR" ]; then
  link_tauri "$APPLE_DIR" "../../../../../node_modules/@tauri-apps/cli/tauri.js"
fi
