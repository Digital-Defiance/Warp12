#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load e2e
warp_env_validate e2e
warp_env_cd_root

E2E_PROJECT="${FIREBASE_E2E_PROJECT:-demo-warp12}"

echo "Building bridge for Firebase e2e (Vite mode e2e)…"
yarn build:double-eighteen
yarn build:engine
yarn build:react
yarn build:theme
node ./node_modules/vite/bin/vite.js build --config apps/Warp12/vite.config.mts --mode e2e

echo "Running Playwright against Auth+Firestore emulators (project ${E2E_PROJECT})…"
echo "(Callable coverage lives in yarn test:functions:emulator — Auth+Firestore+Functions.)"
./node_modules/.bin/firebase emulators:exec \
  --only auth,firestore \
  --project "$E2E_PROJECT" \
  "./node_modules/.bin/playwright test --config apps/Warp12-e2e/playwright.firebase.config.mts"
