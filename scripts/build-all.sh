#!/bin/bash
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [ $# -ne 1 ]; then
  echo "usage: ./scripts/build-all.sh 0.4.0"
  exit 1
fi
echo "Building version $1"
./scripts/build-macos.sh $1 --publish --push-tap
./scripts/build-macos-appstore.sh $1 --upload
./scripts/build-ios-appstore.sh --upload
./scripts/build-android.sh
