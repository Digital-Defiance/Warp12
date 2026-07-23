#!/usr/bin/env bash
# Copy a federation SPA dist into Warp12/federation-hosting/<name>
# so firebase.json `public` stays inside this repo.
# Usage: bash scripts/sync-federation-hosting.sh leaderboard|ops
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IWGF="$(cd "$ROOT/.." && pwd)"
NAME="${1:?usage: sync-federation-hosting.sh leaderboard|ops}"

case "$NAME" in
  leaderboard) SRC="$IWGF/leaderboard/dist" ;;
  ops) SRC="$IWGF/ops/dist" ;;
  *)
    echo "Unknown target: $NAME (expected leaderboard|ops)" >&2
    exit 1
    ;;
esac

if [[ ! -d "$SRC" ]]; then
  echo "Missing dist at $SRC — build the sibling first." >&2
  exit 1
fi

DEST="$ROOT/federation-hosting/$NAME"
rm -rf "$DEST"
mkdir -p "$ROOT/federation-hosting"
cp -R "$SRC" "$DEST"
echo "Synced $SRC → $DEST"
