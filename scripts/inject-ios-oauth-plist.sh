#!/usr/bin/env bash
# Patch Info.ios.plist Google OAuth URL scheme from env (never commit live schemes).
set -euo pipefail

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load ios-oauth
warp_env_cd_root

PLIST="${WARP12_ROOT}/apps/Warp12/src-tauri/Info.ios.plist"
GEN_PLIST="${WARP12_ROOT}/apps/Warp12/src-tauri/gen/apple/warp12_iOS/Info.plist"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -f "$PLIST" ] || die "missing ${PLIST}"

SCHEME="${VITE_GOOGLE_OAUTH_REDIRECT_SCHEME:-}"
if [ -z "$SCHEME" ] && [ -n "${VITE_GOOGLE_IOS_CLIENT_ID:-}" ]; then
  bare="${VITE_GOOGLE_IOS_CLIENT_ID%.apps.googleusercontent.com}"
  SCHEME="com.googleusercontent.apps.${bare}"
fi

BUNDLE_ID="${APPLE_BUNDLE_ID:-com.example.warp12}"
URL_NAME="${BUNDLE_ID}.google-oauth"

python3 - "$PLIST" "$GEN_PLIST" "$SCHEME" "$URL_NAME" <<'PY'
import sys
from pathlib import Path

plist_path = Path(sys.argv[1])
gen_path = Path(sys.argv[2])
scheme = sys.argv[3]
url_name = sys.argv[4]

def patch(path: Path) -> None:
    if not path.is_file():
        return
    text = path.read_text(encoding="utf-8")
    # Replace CFBundleURLName string
    import re
    text2 = re.sub(
        r"(<key>CFBundleURLName</key>\s*<string>)[^<]*(</string>)",
        rf"\1{url_name}\2",
        text,
        count=1,
    )
    if scheme:
        text2 = re.sub(
            r"(<key>CFBundleURLSchemes</key>\s*<array>\s*<string>)[^<]*(</string>)",
            rf"\1{scheme}\2",
            text2,
            count=1,
        )
    if text2 != text:
        path.write_text(text2, encoding="utf-8")
        print(f"Patched OAuth URL types in {path}", file=sys.stderr)
    else:
        print(f"OAuth URL types already up to date: {path}", file=sys.stderr)

patch(plist_path)
patch(gen_path)
if not scheme:
    print(
        "warning: VITE_GOOGLE_IOS_CLIENT_ID / VITE_GOOGLE_OAUTH_REDIRECT_SCHEME unset; "
        "left placeholder scheme",
        file=sys.stderr,
    )
PY
