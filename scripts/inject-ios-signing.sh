#!/usr/bin/env bash
# Fix warp12_iOS manual signing in project.pbxproj.
# Tauri can write PROVISIONING_PROFILE_SPECIFIER outside buildSettings (issue #14462).

set -e

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load ios
warp_env_validate ios
warp_env_cd_root

TAURI_DIR="${WARP12_ROOT}/apps/Warp12/src-tauri"
PBXPROJ="${TAURI_DIR}/gen/apple/warp12.xcodeproj/project.pbxproj"
if [ -n "${APPLE_IOS_PROVISIONING_PROFILE:-}" ]; then
  PROVISION_PROFILE="$(warp_env_abs_path "$APPLE_IOS_PROVISIONING_PROFILE")"
else
  PROVISION_PROFILE="${TAURI_DIR}/Warp_12_iOS.mobileprovision"
fi
APPLE_TEAM_ID="${APPLE_TEAM_ID}"
BUNDLE_ID="${APPLE_BUNDLE_ID}"
SIGN_IDENTITY="${APPLE_IOS_SIGN_IDENTITY:-Apple Distribution: ${APPLE_PUBLISHER_NAME} (${APPLE_TEAM_ID})}"
PRODUCT_NAME="${APPLE_PRODUCT_NAME:-Warp 12}"

die() {
  echo "error: $*" >&2
  exit 1
}

[ -f "$PBXPROJ" ] || die "missing ${PBXPROJ}"
[ -f "$PROVISION_PROFILE" ] || die "missing iOS profile: ${PROVISION_PROFILE}"
[ -n "$APPLE_TEAM_ID" ] || die "APPLE_TEAM_ID is required"
[ -n "$BUNDLE_ID" ] || die "APPLE_BUNDLE_ID is required"

PROFILE_SPEC="$(security cms -D -i "$PROVISION_PROFILE" 2>/dev/null | plutil -extract Name raw - 2>/dev/null || true)"
[ -n "$PROFILE_SPEC" ] || die "could not read profile name from ${PROVISION_PROFILE}"

python3 - "$PBXPROJ" "$PROFILE_SPEC" "$APPLE_TEAM_ID" "$SIGN_IDENTITY" "$BUNDLE_ID" "$PRODUCT_NAME" <<'PY'
import re
import sys

pbxproj_path, profile_spec, team_id, sign_identity, bundle_id, product_name = sys.argv[1:7]

with open(pbxproj_path, "r", encoding="utf-8") as f:
    content = f.read()

LIB_ARM64 = (
    '"$(inherited) $(PROJECT_DIR)/Externals/arm64/$(CONFIGURATION) '
    '$(SDKROOT)/usr/lib/swift $(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain'
    '/usr/lib/swift/$(PLATFORM_NAME) $(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain'
    '/usr/lib/swift-5.0/$(PLATFORM_NAME)"'
)
LIB_X86 = (
    '"$(inherited) $(PROJECT_DIR)/Externals/x86_64/$(CONFIGURATION) '
    '$(SDKROOT)/usr/lib/swift $(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain'
    '/usr/lib/swift/$(PLATFORM_NAME) $(DEVELOPER_DIR)/Toolchains/XcodeDefault.xctoolchain'
    '/usr/lib/swift-5.0/$(PLATFORM_NAME)"'
)

def target_config(config_id, name):
    return f"""\t\t{config_id} /* {name} */ = {{
\t\t\tisa = XCBuildConfiguration;
\t\t\tbuildSettings = {{
\t\t\t\tALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES = YES;
\t\t\t\tARCHS = (
\t\t\t\t\tarm64,
\t\t\t\t);
\t\t\t\tASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
\t\t\t\tCODE_SIGN_ENTITLEMENTS = warp12_iOS/warp12_iOS.entitlements;
\t\t\t\tCODE_SIGN_IDENTITY = "{sign_identity}";
\t\t\t\tCODE_SIGN_STYLE = Manual;
\t\t\t\t"CODE_SIGN_IDENTITY[sdk=iphoneos*]" = "{sign_identity}";
\t\t\t\tDEVELOPMENT_TEAM = {team_id};
\t\t\t\t"DEVELOPMENT_TEAM[sdk=iphoneos*]" = {team_id};
\t\t\t\tENABLE_BITCODE = NO;
\t\t\t\t"EXCLUDED_ARCHS[sdk=iphoneos*]" = x86_64;
\t\t\t\tFRAMEWORK_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"\\".\\"",
\t\t\t\t);
\t\t\t\tINFOPLIST_FILE = warp12_iOS/Info.plist;
\t\t\t\tLD_RUNPATH_SEARCH_PATHS = (
\t\t\t\t\t"$(inherited)",
\t\t\t\t\t"@executable_path/Frameworks",
\t\t\t\t);
\t\t\t\t"LIBRARY_SEARCH_PATHS[arch=arm64]" = {LIB_ARM64};
\t\t\t\t"LIBRARY_SEARCH_PATHS[arch=x86_64]" = {LIB_X86};
\t\t\t\tPRODUCT_BUNDLE_IDENTIFIER = {bundle_id};
\t\t\t\tPRODUCT_NAME = "{product_name}";
\t\t\t\tPROVISIONING_PROFILE_SPECIFIER = "{profile_spec}";
\t\t\t\t"PROVISIONING_PROFILE_SPECIFIER[sdk=iphoneos*]" = "{profile_spec}";
\t\t\t\tSDKROOT = iphoneos;
\t\t\t\tTARGETED_DEVICE_FAMILY = "1,2";
\t\t\t\tVALID_ARCHS = arm64;
\t\t\t}};
\t\t\tname = {name};
\t\t}};"""

debug_block = target_config("08BB34FF3DED402245339E20", "debug")
release_block = target_config("4B03F6B868D32A8D14F354C8", "release")

pattern = re.compile(
    r"\t\t08BB34FF3DED402245339E20 /\* debug \*/ = \{.*?"
    r"\t\t4B03F6B868D32A8D14F354C8 /\* release \*/ = \{.*?\n\t\t\};",
    re.DOTALL,
)

replacement = debug_block + "\n" + release_block
new_content, count = pattern.subn(replacement, content, count=1)
if count != 1:
    sys.stderr.write(
        "error: could not locate warp12_iOS debug/release buildSettings blocks to inject\n"
    )
    sys.exit(1)

with open(pbxproj_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print(
    f"Injected iOS signing: team={team_id} bundle={bundle_id} profile={profile_spec}",
    file=sys.stderr,
)
PY
