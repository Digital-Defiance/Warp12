#!/usr/bin/env bash
# Stage built monorepo libs under functions/vendor for Firebase (npm) deploys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VENDOR="$ROOT/functions/vendor"
MODELS="$ROOT/functions/models"

cd "$ROOT"
yarn build:double-eighteen
yarn build:engine

rm -rf "$VENDOR"
mkdir -p "$VENDOR" "$MODELS"

node "$ROOT/scripts/stage-functions-vendor.mjs" \
  "$ROOT/vendor/double-eighteen" \
  "$VENDOR/double-eighteen"

node "$ROOT/scripts/stage-functions-vendor.mjs" \
  "$ROOT/libs/engine" \
  "$VENDOR/warp12-engine"

# Yarn (nodeLinker: node-modules) materializes `file:vendor/...` deps as a
# COPY into functions/node_modules, keyed by content hash — it does not
# symlink live to vendor/. Since we just rewrote vendor/ in place, that copy
# is now stale and `tsc` would silently type-check against the old engine
# build. Re-running install forces Yarn to notice and re-materialize it.
yarn install

# Class II (Ω) weights — required for practice-AI replay verification.
cp "$ROOT/apps/Warp12/public/models/omega-v1.json" "$MODELS/omega-v1.json"
cp "$ROOT/apps/Warp12/public/models/omega-goout-v1.json" "$MODELS/omega-goout-v1.json"

echo "Staged functions vendor packages in functions/vendor/"
echo "Staged Omega weights in functions/models/"
