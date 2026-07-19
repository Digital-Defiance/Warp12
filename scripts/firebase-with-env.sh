#!/usr/bin/env bash
# Run firebase CLI with FIREBASE_PROJECT from .env / process ENV.
# Usage: bash scripts/firebase-with-env.sh deploy --only hosting
set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load deploy
warp_env_validate deploy
warp_env_cd_root

exec firebase "$@" --project "$FIREBASE_PROJECT"
