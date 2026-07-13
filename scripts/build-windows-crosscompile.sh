#!/usr/bin/env bash
# Cross-compile Warp 12 for Windows from macOS
# Usage: ./scripts/build-windows-crosscompile.sh

set -e

echo "🔨 Cross-compiling Warp 12 for Windows from macOS..."

# Ensure we're in the repo root
cd "$(dirname "$0")/.."

# Build all dependencies first
echo ""
echo "📦 Building dependencies..."
yarn build:all

# Navigate to Tauri app
cd apps/Warp12

# Check if cargo-xwin is installed
if ! command -v cargo-xwin &> /dev/null; then
    echo "❌ cargo-xwin not found. Installing..."
    cargo install cargo-xwin
fi

# Check if Windows target is installed
if ! rustup target list --installed | grep -q "x86_64-pc-windows-msvc"; then
    echo "📥 Installing Windows target..."
    rustup target add x86_64-pc-windows-msvc
fi

# Cross-compile the Rust binary
echo ""
echo "🦀 Cross-compiling Rust binary for Windows..."
cd src-tauri
cargo xwin build --release --target x86_64-pc-windows-msvc

# Note: cargo-xwin only builds the binary, not the full installer
# For full MSIX/MSI packaging, you still need to build on Windows
echo ""
echo "✅ Windows binary built successfully!"
echo ""
echo "📍 Location: apps/Warp12/src-tauri/target/x86_64-pc-windows-msvc/release/Warp 12.exe"
echo ""
echo "⚠️  Note: This creates the .exe binary only."
echo "   For full installers (MSI/MSIX), you'll need to package on Windows."
echo ""
echo "Next steps:"
echo "  1. Test the .exe on Windows"
echo "  2. Use Windows to create full installer if needed"
