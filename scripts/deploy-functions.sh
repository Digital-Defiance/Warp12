#!/usr/bin/env bash
# Deploy Gen2 functions, then always apply Cloud Run invoker + SA fixes.
#
# Org policy blocks allUsers invoker bindings. Functions are deployed with
# invoker: 'private' (see functions/src/index.ts). ensure-functions-public-invoker.sh
# then uses --no-invoker-iam-check so callables remain reachable from the browser.
set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load deploy
warp_env_validate deploy
warp_env_cd_root

PROJECT="${FIREBASE_PROJECT}"

firebase deploy --only functions --project "$PROJECT"
DEPLOY_EXIT=$?

if [ "$DEPLOY_EXIT" -ne 0 ]; then
  echo "" >&2
  echo "Firebase deploy exited ${DEPLOY_EXIT}." >&2
  echo "If the only failure was 'Failed to set invoker' / allUsers IAM, that is expected" >&2
  echo "under domain-restricted sharing — continuing with the Cloud Run invoker workaround." >&2
  echo "" >&2
fi

/usr/bin/env bash "$WARP12_ROOT/scripts/ensure-functions-public-invoker.sh"
/usr/bin/env bash "$WARP12_ROOT/scripts/ensure-functions-auth-permissions.sh"

if [ "$DEPLOY_EXIT" -ne 0 ]; then
  echo "" >&2
  echo "Post-deploy invoker + auth fixes finished. Re-run yarn deploy:functions after" >&2
  echo "pulling invoker: 'private' in setGlobalOptions so Firebase stops trying allUsers." >&2
  exit "$DEPLOY_EXIT"
fi

echo "Functions deploy + invoker/auth fixes completed."
