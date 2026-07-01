#!/usr/bin/env bash
# Copy canonical markdown from the monorepo into docs/ for Jekyll (GitHub Pages safe mode).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cp "$ROOT/RULES.md" "$ROOT/docs/rules.md"
cp "$ROOT/tools/nn/README.md" "$ROOT/docs/neural-training.md"
echo "Synced rules.md and neural-training.md into docs/"
