#!/usr/bin/env bash
# Deploy Gen2 functions, then always apply Cloud Run invoker + SA fixes.
# Firebase may fail setting allUsers when org policy blocks public IAM bindings;
# ensure-functions-public-invoker.sh uses --no-invoker-iam-check instead.
set -euo pipefail

PROJECT="${FIREBASE_PROJECT:-warp-12}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

firebase deploy --only functions --project "$PROJECT"
DEPLOY_EXIT=$?

/usr/bin/env bash "$ROOT/scripts/ensure-functions-public-invoker.sh"
/usr/bin/env bash "$ROOT/scripts/ensure-functions-auth-permissions.sh"

exit "$DEPLOY_EXIT"
