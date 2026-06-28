#!/usr/bin/env bash
# Publish an npm package with 2FA OTP.
# Usage: scripts/npm-publish-otp.sh <package-dir>
# Set OTP in the environment, or enter it when prompted.

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: scripts/npm-publish-otp.sh <package-dir>" >&2
  exit 1
fi

PACKAGE_DIR="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [[ ! -f "$ROOT/$PACKAGE_DIR/package.json" ]]; then
  echo "No package.json in $PACKAGE_DIR" >&2
  exit 1
fi

if [[ -z "${OTP:-}" ]]; then
  read -rp "npm one-time password (6-digit authenticator code): " OTP
  echo
fi

if [[ ! "$OTP" =~ ^[0-9]{6,8}$ ]]; then
  echo "OTP must be 6–8 digits from your authenticator app." >&2
  exit 1
fi

NAME="$(node -p "require('$ROOT/$PACKAGE_DIR/package.json').name")"
echo "Publishing $NAME from $PACKAGE_DIR..."
(cd "$ROOT/$PACKAGE_DIR" && npm publish --access public --otp="$OTP")
