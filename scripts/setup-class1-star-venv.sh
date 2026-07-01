#!/usr/bin/env bash
# Create Python venv and install Class I* training deps.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$ROOT/tools/nn/.venv"

python3 -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip
"$VENV/bin/pip" install -r "$ROOT/tools/nn/requirements.txt"

echo "Class I* venv ready: $VENV/bin/python"
