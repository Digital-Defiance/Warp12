#!/usr/bin/env bash
# Stage built monorepo libs under functions/vendor for Firebase (npm) deploys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/functions/vendor"

cd "$ROOT"
yarn build:doubletwelve
yarn build:engine

rm -rf "$VENDOR"
mkdir -p "$VENDOR"

node "$ROOT/scripts/stage-functions-vendor.mjs" \
  "$ROOT/vendor/DoubleTwelve" \
  "$VENDOR/doubletwelve"

node "$ROOT/scripts/stage-functions-vendor.mjs" \
  "$ROOT/libs/engine" \
  "$VENDOR/warp12-engine"

echo "Staged functions vendor packages in functions/vendor/"
