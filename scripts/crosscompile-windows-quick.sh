#!/usr/bin/env bash
# Quick cross-compile test (assumes libs are already built)
# Usage: ./scripts/crosscompile-windows-quick.sh

set -e

echo "🔨 Cross-compiling Warp 12 binary for Windows..."

cd "$(dirname "$0")/../apps/Warp12/src-tauri"

# Cross-compile just the Rust binary
cargo xwin build --release --target x86_64-pc-windows-msvc

echo ""
echo "✅ Success! Windows binary created:"
ls -lh target/x86_64-pc-windows-msvc/release/*.exe 2>/dev/null || \
ls -lh target/x86_64-pc-windows-msvc/release/ | grep -v "\.d$"
