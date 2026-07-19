#!/usr/bin/env bash
set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load e2e
warp_env_validate e2e
warp_env_cd_root

E2E_PROJECT="${FIREBASE_E2E_PROJECT:-demo-warp12}"

# defineString params for Gen2 functions (committed demo values).
if [ -f "functions/.env.${E2E_PROJECT}" ]; then
  # shellcheck disable=SC1090
  set -a
  # Safe: file is KEY=value only (no command substitution).
  . "functions/.env.${E2E_PROJECT}"
  set +a
fi

export BOOTSTRAP_ADMIN_SECRET="${BOOTSTRAP_ADMIN_SECRET:-e2e-bootstrap-admin-secret}"
export CERTIFICATE_SIGNING_SECRET="${CERTIFICATE_SIGNING_SECRET:-e2e-certificate-signing-secret}"

echo "Building Cloud Functions for emulator suite…"
yarn workspace @warp12/functions build

echo "Running callable integration tests (project ${E2E_PROJECT})…"
./node_modules/.bin/firebase emulators:exec \
  --only auth,firestore,functions \
  --project "$E2E_PROJECT" \
  "./node_modules/.bin/vitest run --config functions/vitest.emulator.config.mts"
