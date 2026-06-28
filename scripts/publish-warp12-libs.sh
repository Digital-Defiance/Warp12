#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

yarn prepublish:check

if [[ -z "${OTP:-}" ]]; then
  read -rp "npm one-time password (6-digit authenticator code): " OTP
  echo
  export OTP
fi

"$ROOT/scripts/npm-publish-otp.sh" libs/engine
"$ROOT/scripts/npm-publish-otp.sh" libs/react
"$ROOT/scripts/npm-publish-otp.sh" libs/theme

echo "Published warp12-engine, warp12-react, and warp12-theme."
