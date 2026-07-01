#!/usr/bin/env bash
# Copy minimal ONNX Runtime Web WASM assets for Class I* inference (offline/Tauri).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/node_modules/onnxruntime-web/dist"
DEST="$ROOT/apps/Warp12/public/ort"

if [[ ! -d "$SRC" ]]; then
  echo "onnxruntime-web dist not found — run yarn install from repo root." >&2
  exit 1
fi

mkdir -p "$DEST"
rm -f "$DEST"/*

cp "$SRC/ort-wasm-simd-threaded.wasm" "$SRC/ort-wasm-simd-threaded.mjs" "$DEST"/

echo "Synced minimal ORT wasm (~13MB) to $DEST"
