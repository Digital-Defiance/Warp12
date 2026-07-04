#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "Building bridge for Firebase e2e (Vite mode e2e)…"
yarn build:doubletwelve
yarn build:engine
yarn build:react
yarn build:theme
node ./node_modules/vite/bin/vite.js build --config apps/Warp12/vite.config.mts --mode e2e

echo "Running Playwright against Firebase emulators…"
./node_modules/.bin/firebase emulators:exec \
  --only auth,firestore \
  --project demo-warp12 \
  "./node_modules/.bin/playwright test --config apps/Warp12-e2e/playwright.firebase.config.mts"
