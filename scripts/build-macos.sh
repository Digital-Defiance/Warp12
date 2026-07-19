#!/usr/bin/env bash
# Universal signed + notarized macOS DMG (bash 3.2+ / macOS default bash).
# Prompts for any missing Apple signing / notarization environment variables.
#
# Usage:
#   bash scripts/build-macos.sh
#   bash scripts/build-macos.sh 0.2.0
#   bash scripts/build-macos.sh --version 0.2.0
#   bash scripts/build-macos.sh --skip-notarize 0.1.0
#   bash scripts/build-macos.sh 0.2.0 --publish --push-tap
#   NONINTERACTIVE=1 bash scripts/build-macos.sh 0.1.0 --publish
#
# DMG + GitHub release asset: Warp_12_<version>_universal.dmg (no spaces — GitHub sanitizes spaces in asset names)

set -e

# shellcheck source=scripts/lib/warp-env.sh
. "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/lib/warp-env.sh"
warp_env_load macos
warp_env_validate macos
warp_env_cd_root

ROOT="$WARP12_ROOT"
BRIDGE_DIR="${ROOT}/apps/Warp12"
TAURI_DIR="${BRIDGE_DIR}/src-tauri"
PKG_JSON="${BRIDGE_DIR}/package.json"
TAURI_CONF="${TAURI_DIR}/tauri.conf.json"
CARGO_TOML="${TAURI_DIR}/Cargo.toml"
DMG_DIR="${TAURI_DIR}/target/universal-apple-darwin/release/bundle/dmg"
TAURI_BIN="${ROOT}/node_modules/.bin/tauri"
ENTITLEMENTS_DEVELOPER_ID_TEMPLATE="${TAURI_DIR}/Entitlements.DeveloperID.plist.in"
ENTITLEMENTS_PLIST="${TAURI_DIR}/Entitlements.plist"
DEFAULT_DEVELOPER_ID_TEAM="${DEFAULT_DEVELOPER_ID_TEAM:-${APPLE_TEAM_ID}}"

SKIP_NOTARIZE=0
EXTRA_TAURI_ARGS=""
APP_VERSION=""
PUBLISH=0
PUSH_TAP=0
PUSH_GIT_TAG=1
RELEASE_TAG=""
# Required for --publish; validated when publish runs
GITHUB_REPO="${GITHUB_REPO:-}"
HOMEBREW_TAP_DIR="${HOMEBREW_TAP_DIR:-}"
TAURI_LOCAL_CONF=""

die() {
  echo "error: $*" >&2
  exit 1
}

usage() {
  cat >&2 <<'EOF'
Usage: bash scripts/build-macos.sh [OPTIONS] [VERSION] [-- extra tauri build args...]

  VERSION          Semver for the bundle (default: apps/Warp12/package.json "version").
                   Writes apps/Warp12/package.json, src-tauri/tauri.conf.json, Cargo.toml.
                   Output: apps/Warp12/src-tauri/target/universal-apple-darwin/release/bundle/dmg/
                           Warp_12_<VERSION>_universal.dmg (release asset; local Tauri name may include spaces)

  --version VER    Same as positional VERSION (v0.1.0 accepted; leading v is stripped)
  --release-tag TAG
                   Git tag for GitHub release (default: v<VERSION>, e.g. v0.2.0)
  --publish        Create GitHub release, upload DMG, update homebrew-tap cask
  --push-tap       After --publish, commit and push HOMEBREW_TAP_DIR (implies --publish)
  --no-push-tag    Do not create/push a git tag before gh release (tag must exist)

Environment (set before build or enter when prompted):

  Signing
    APPLE_SIGNING_IDENTITY   Developer ID Application: … (TEAMID)

  Notarization (pick one method)
    APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID
    APPLE_API_KEY, APPLE_API_ISSUER, APPLE_API_KEY_PATH

  Publish (--publish)
    WARP12_CREATE_GIT_TAG=0     Skip creating a new local tag (needs existing tag)
    WARP12_PUSH_HOMEBREW_TAP=0  Commit cask only; do not push homebrew-tap
    gh                  GitHub CLI (gh auth login)
    GITHUB_REPO         owner/repo (required for --publish; see .env.example)
    HOMEBREW_TAP_DIR    path to homebrew tap checkout (required for --publish)

Org identity (required; process ENV or repo-root .env):
    APPLE_TEAM_ID, APPLE_BUNDLE_ID, APPLE_PUBLISHER_NAME
EOF
  exit 1
}

looks_like_version() {
  case "$1" in
    v[0-9]*.[0-9]*.[0-9]**) return 0 ;;
    [0-9]*.[0-9]*.[0-9]**) return 0 ;;
    *) return 1 ;;
  esac
}

normalize_version() {
  printf '%s' "$1" | sed 's/^v//'
}

read_product_name() {
  [ -f "$TAURI_CONF" ] || die "missing ${TAURI_CONF}"
  node -e "
    const j = require(process.argv[1]);
    process.stdout.write(String(j.productName || 'Warp 12'));
  " "$TAURI_CONF"
}

read_version_from_package_json() {
  if [ ! -f "$PKG_JSON" ]; then
    return 1
  fi
  node -e "const p=require(process.argv[1]); if(p.version) process.stdout.write(String(p.version));" "$PKG_JSON" 2>/dev/null
}

apply_app_version() {
  _ver="$1"
  if [ -z "$_ver" ]; then
    die "empty version"
  fi
  if ! looks_like_version "$_ver" && ! looks_like_version "v${_ver}"; then
    die "invalid semver: ${_ver} (expected e.g. 0.1.0 or v0.1.0)"
  fi
  _ver="$(normalize_version "$_ver")"
  command -v node >/dev/null 2>&1 || die "node is required to set app version"

  echo "Setting app version to ${_ver} (package.json, tauri.conf.json, Cargo.toml, mobile build codes)..." >&2
  node "${ROOT}/scripts/app-version.mjs" set "$_ver" >/dev/null || die "failed to set app version"

  APP_VERSION="$_ver"
  export APP_VERSION
}

resolve_app_version() {
  if [ -n "${APP_VERSION:-}" ]; then
    APP_VERSION="$(normalize_version "$APP_VERSION")"
    return 0
  fi
  _from_pkg="$(read_version_from_package_json || true)"
  if [ -n "$_from_pkg" ]; then
    APP_VERSION="$(normalize_version "$_from_pkg")"
    return 0
  fi
  die "could not determine version; pass 0.1.0 or set apps/Warp12/package.json version"
}

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-notarize) SKIP_NOTARIZE=1; shift ;;
    --publish) PUBLISH=1; shift ;;
    --push-tap) PUBLISH=1; PUSH_TAP=1; shift ;;
    --no-push-tag) PUSH_GIT_TAG=0; shift ;;
    --release-tag)
      shift
      [ -n "${1:-}" ] || die "--release-tag requires a value"
      RELEASE_TAG="$1"
      shift
      ;;
    --version)
      shift
      [ -n "${1:-}" ] || die "--version requires a value"
      APP_VERSION="$(normalize_version "$1")"
      shift
      ;;
    -h|--help) usage ;;
    --)
      shift
      while [ $# -gt 0 ]; do
        EXTRA_TAURI_ARGS="${EXTRA_TAURI_ARGS} $1"
        shift
      done
      break
      ;;
    *)
      if [ -z "${APP_VERSION:-}" ] && looks_like_version "$1"; then
        APP_VERSION="$(normalize_version "$1")"
        shift
      else
        EXTRA_TAURI_ARGS="${EXTRA_TAURI_ARGS} $1"
        shift
      fi
      ;;
  esac
done

resolve_app_version
apply_app_version "$APP_VERSION"

if [ "$(uname -s)" != "Darwin" ]; then
  echo "error: macOS release build must run on macOS" >&2
  exit 1
fi

if [ -z "${BASH_VERSION:-}" ]; then
  echo "error: run with bash, not sh: bash scripts/build-macos.sh" >&2
  exit 1
fi

[ -x "$TAURI_BIN" ] || TAURI_BIN="$(command -v tauri || true)"
[ -n "$TAURI_BIN" ] || die "tauri CLI not found; run yarn install from repo root"

PRODUCT_NAME="$(read_product_name)"

release_tag_name() {
  if [ -n "${RELEASE_TAG:-}" ]; then
    case "$RELEASE_TAG" in
      v*) printf '%s' "$RELEASE_TAG" ;;
      *) printf 'v%s' "$RELEASE_TAG" ;;
    esac
    return 0
  fi
  printf 'v%s' "$APP_VERSION"
}

dmg_asset_basename() {
  printf 'Warp_12_%s_universal.dmg' "$APP_VERSION"
}

find_built_dmg() {
  _expected="${DMG_DIR}/$(dmg_asset_basename)"
  if [ -f "$_expected" ]; then
    printf '%s' "$_expected"
    return 0
  fi
  _newest="$(ls -1t "${DMG_DIR}"/*.dmg 2>/dev/null | head -1)"
  if [ -n "$_newest" ] && [ -f "$_newest" ]; then
    printf '%s' "$_newest"
    return 0
  fi
  return 1
}

sha256_file() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
  else
    sha256sum "$1" | awk '{print $1}'
  fi
}

ensure_git_release_tag() {
  _tag="$(release_tag_name)"
  if git rev-parse "$_tag" >/dev/null 2>&1; then
    echo "Git tag ${_tag} exists locally." >&2
  else
    if [ "${WARP12_CREATE_GIT_TAG:-}" = "0" ]; then
      die "tag ${_tag} does not exist and WARP12_CREATE_GIT_TAG=0"
    fi
    if is_interactive && [ "${NONINTERACTIVE:-}" != "1" ]; then
      printf "Create git tag %s on HEAD? [y/N] " "$_tag"
      read -r _ans
      _ans="$(printf '%s' "${_ans:-N}" | tr '[:upper:]' '[:lower:]')"
      case "$_ans" in
        y|yes) ;;
        *) die "aborted — create tag ${_tag} or pass --no-push-tag if it exists on remote" ;;
      esac
    fi
    git tag "$_tag"
    echo "Created tag ${_tag}." >&2
  fi

  if [ "$PUSH_GIT_TAG" -eq 1 ]; then
    echo "Pushing ${_tag} to origin..." >&2
    git push origin "$_tag"
  fi
}

publish_github_and_homebrew() {
  warp_env_require GITHUB_REPO HOMEBREW_TAP_DIR
  _src_dmg="$(find_built_dmg)" || die "DMG not found under ${DMG_DIR}/"
  command -v gh >/dev/null 2>&1 || die "gh CLI not found (brew install gh && gh auth login)"

  _tag="$(release_tag_name)"
  _asset_name="$(dmg_asset_basename)"
  if [ "$(basename "$_src_dmg")" = "$_asset_name" ]; then
    _staging="$_src_dmg"
  else
    _staging="${DMG_DIR}/${_asset_name}"
    cp -f "$_src_dmg" "$_staging"
  fi

  _sha="$(sha256_file "$_staging")"
  echo "DMG: ${_staging}" >&2
  echo "sha256: ${_sha}" >&2
  echo "Release tag: ${_tag}" >&2

  if [ "$PUSH_GIT_TAG" -eq 1 ]; then
    ensure_git_release_tag
  elif ! gh release view "$_tag" --repo "$GITHUB_REPO" >/dev/null 2>&1; then
    die "GitHub release ${_tag} missing; create tag or omit --no-push-tag"
  fi

  _title="Warp 12 ${APP_VERSION}"
  if gh release view "$_tag" --repo "$GITHUB_REPO" >/dev/null 2>&1; then
    echo "Uploading to existing release ${_tag}..." >&2
    gh release upload "$_tag" "$_staging" --repo "$GITHUB_REPO" --clobber
  else
    echo "Creating GitHub release ${_tag}..." >&2
    gh release create "$_tag" "$_staging" \
      --repo "$GITHUB_REPO" \
      --title "$_title" \
      --generate-notes
  fi

  _asset_url_name="$(printf '%s' "$_asset_name" | sed 's/ /%20/g')"
  _release_url="https://github.com/${GITHUB_REPO}/releases/download/${_tag}/${_asset_url_name}"
  echo "Release asset: ${_release_url}" >&2

  bash "${ROOT}/scripts/update-warp12-cask.sh" "$APP_VERSION" "$_sha"

  if [ "$PUSH_TAP" -eq 1 ]; then
    _cask="${HOMEBREW_TAP_DIR}/Casks/warp12.rb"
    if [ ! -d "${HOMEBREW_TAP_DIR}/.git" ]; then
      die "not a git repo: ${HOMEBREW_TAP_DIR}"
    fi
    (
      cd "$HOMEBREW_TAP_DIR"
      git add "Casks/warp12.rb"
      if git diff --cached --quiet; then
        echo "homebrew-tap: no cask changes to commit." >&2
      else
        _msg="warp12 ${APP_VERSION}"
        git commit -m "$_msg"
        if [ "${WARP12_PUSH_HOMEBREW_TAP:-}" = "0" ]; then
          echo "homebrew-tap: committed locally; push skipped (WARP12_PUSH_HOMEBREW_TAP=0)." >&2
        elif is_interactive && [ "${NONINTERACTIVE:-}" != "1" ]; then
          printf "Push homebrew-tap to origin? [y/N] "
          read -r _push_ans
          _push_ans="$(printf '%s' "${_push_ans:-N}" | tr '[:upper:]' '[:lower:]')"
          case "$_push_ans" in
            y|yes) git push origin HEAD ;;
            *) echo "Skipped push. Commit is local in ${HOMEBREW_TAP_DIR}" >&2 ;;
          esac
        else
          git push origin HEAD
        fi
      fi
    )
  else
    echo "homebrew-tap updated locally. Commit with:" >&2
    echo "  cd ${HOMEBREW_TAP_DIR} && git add Casks/warp12.rb && git commit -m 'warp12 ${APP_VERSION}' && git push" >&2
  fi
}

is_interactive() {
  [ -z "${CI:-}" ] && [ "${NONINTERACTIVE:-}" != "1" ]
}

prompt_nonempty() {
  var_name="$1"
  prompt_text="$2"
  secret="${3:-0}"
  value=""
  while [ -z "$value" ]; do
    if [ "$secret" = "1" ]; then
      read -r -s -p "${prompt_text}: " value
      echo "" >&2
    else
      read -r -p "${prompt_text}: " value
    fi
    value="$(printf '%s' "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  done
  eval "$var_name=\$value"
  export "$var_name"
}

infer_team_from_signing_identity() {
  if [ -z "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    _team="$(printf '%s' "$APPLE_SIGNING_IDENTITY" | sed -n 's/.*(\([A-Z0-9][A-Z0-9]*\)).*/\1/p' | head -1)"
    if [ -n "$_team" ]; then
      APPLE_TEAM_ID="$_team"
      export APPLE_TEAM_ID
      echo "APPLE_TEAM_ID: inferred ${APPLE_TEAM_ID} from signing identity." >&2
    fi
  fi
}

list_developer_id_identities() {
  security find-identity -p codesigning 2>/dev/null \
    | grep 'Developer ID Application:' \
    | sed -n 's/.*"\(Developer ID Application:[^"]*\)".*/\1/p' \
    | sort -u
}

lookup_identity_name_by_hash() {
  _hash="$(printf '%s' "$1" | tr '[:lower:]' '[:upper:]')"
  security find-identity -p codesigning -v 2>/dev/null \
    | grep -i "$_hash" \
    | sed -n 's/.*"\([^"]*\)".*/\1/p' \
    | head -1
}

normalize_signing_identity_value() {
  _value="$(printf '%s' "$1" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if printf '%s' "$_value" | grep -Eq '^[0-9A-Fa-f]{40}$'; then
    _resolved="$(lookup_identity_name_by_hash "$_value")"
    if [ -z "$_resolved" ]; then
      die "no codesigning identity found for certificate hash ${_value}"
    fi
    printf '%s' "$_resolved"
    return 0
  fi
  printf '%s' "$_value"
}

validate_developer_id_signing_identity() {
  case "${APPLE_SIGNING_IDENTITY:-}" in
    "Developer ID Application:"*) return 0 ;;
    "Apple Distribution:"*)
      die "APPLE_SIGNING_IDENTITY is an App Store certificate (Apple Distribution).
Notarized DMGs require Developer ID Application, e.g.:
  Developer ID Application: ${APPLE_PUBLISHER_NAME} (${DEFAULT_DEVELOPER_ID_TEAM})
Unset APPLE_SIGNING_IDENTITY and re-run, or export the Developer ID identity name (not the App Store hash)."
      ;;
    "3rd Party Mac Developer Application:"*)
      die "APPLE_SIGNING_IDENTITY is a Mac App Store development certificate.
Use Developer ID Application for scripts/build-macos.sh."
      ;;
    *)
      die "APPLE_SIGNING_IDENTITY must be a Developer ID Application certificate.
Current value: ${APPLE_SIGNING_IDENTITY:-<unset>}
Available identities:
$(list_developer_id_identities | sed 's/^/  /')"
      ;;
  esac
}

pick_default_developer_id_identity() {
  _preferred=""
  _fallback=""
  while IFS= read -r _line; do
    [ -z "$_line" ] && continue
    if [ -z "$_fallback" ]; then
      _fallback="$_line"
    fi
    if printf '%s' "$_line" | grep -q "(${DEFAULT_DEVELOPER_ID_TEAM})"; then
      _preferred="$_line"
    fi
  done <<EOF
$(list_developer_id_identities)
EOF
  if [ -n "$_preferred" ]; then
    printf '%s' "$_preferred"
    return 0
  fi
  printf '%s' "$_fallback"
}

generate_developer_id_entitlements() {
  [ -f "$ENTITLEMENTS_DEVELOPER_ID_TEMPLATE" ] || die "missing ${ENTITLEMENTS_DEVELOPER_ID_TEMPLATE}"
  cp "$ENTITLEMENTS_DEVELOPER_ID_TEMPLATE" "$ENTITLEMENTS_PLIST"
  echo "Wrote Developer ID entitlements → ${ENTITLEMENTS_PLIST}" >&2
}

ensure_signing_identity() {
  if [ -n "${APPLE_SIGNING_IDENTITY:-}" ]; then
    APPLE_SIGNING_IDENTITY="$(normalize_signing_identity_value "$APPLE_SIGNING_IDENTITY")"
    export APPLE_SIGNING_IDENTITY
    validate_developer_id_signing_identity
    infer_team_from_signing_identity
    echo "Signing: ${APPLE_SIGNING_IDENTITY}" >&2
    return 0
  fi

  _tmp="$(mktemp -t w12-sign.XXXXXX)"
  list_developer_id_identities > "$_tmp"
  _count=0
  _single=""
  while IFS= read -r _line; do
    [ -z "$_line" ] && continue
    _count=$((_count + 1))
    _single="$_line"
  done < "$_tmp"
  rm -f "$_tmp"

  if [ "$_count" -eq 1 ]; then
    APPLE_SIGNING_IDENTITY="$_single"
    export APPLE_SIGNING_IDENTITY
    infer_team_from_signing_identity
    echo "Signing: auto-selected ${APPLE_SIGNING_IDENTITY}" >&2
    return 0
  fi

  if [ "$_count" -gt 1 ]; then
    _default="$(pick_default_developer_id_identity)"
    if [ -n "$_default" ]; then
      APPLE_SIGNING_IDENTITY="$_default"
      export APPLE_SIGNING_IDENTITY
      infer_team_from_signing_identity
      echo "Signing: auto-selected ${APPLE_SIGNING_IDENTITY}" >&2
      echo "  (override with APPLE_SIGNING_IDENTITY if needed)" >&2
      return 0
    fi
    echo "warning: multiple Developer ID Application identities; set APPLE_SIGNING_IDENTITY." >&2
    list_developer_id_identities | while IFS= read -r _line; do
      [ -n "$_line" ] && echo "  - ${_line}" >&2
    done
  else
    echo "warning: no Developer ID Application identity in keychain." >&2
  fi

  if ! is_interactive; then
    die "APPLE_SIGNING_IDENTITY is not set"
  fi

  prompt_nonempty APPLE_SIGNING_IDENTITY "APPLE_SIGNING_IDENTITY (Developer ID Application: …)"
  APPLE_SIGNING_IDENTITY="$(normalize_signing_identity_value "$APPLE_SIGNING_IDENTITY")"
  export APPLE_SIGNING_IDENTITY
  validate_developer_id_signing_identity
  infer_team_from_signing_identity
  echo "Signing: ${APPLE_SIGNING_IDENTITY}" >&2
}

has_notary_api_key() {
  [ -n "${APPLE_API_KEY:-}" ] && [ -n "${APPLE_API_ISSUER:-}" ] && [ -n "${APPLE_API_KEY_PATH:-}" ]
}

has_notary_password() {
  [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]
}

missing_notary_api_vars() {
  _m=""
  [ -n "${APPLE_API_KEY:-}" ] || _m="${_m}APPLE_API_KEY
"
  [ -n "${APPLE_API_ISSUER:-}" ] || _m="${_m}APPLE_API_ISSUER
"
  [ -n "${APPLE_API_KEY_PATH:-}" ] || _m="${_m}APPLE_API_KEY_PATH
"
  [ -z "$_m" ] && return 1
  printf '%s' "$_m"
}

missing_notary_password_vars() {
  _m=""
  [ -n "${APPLE_ID:-}" ] || _m="${_m}APPLE_ID
"
  [ -n "${APPLE_PASSWORD:-}" ] || _m="${_m}APPLE_PASSWORD
"
  [ -n "${APPLE_TEAM_ID:-}" ] || _m="${_m}APPLE_TEAM_ID
"
  [ -z "$_m" ] && return 1
  printf '%s' "$_m"
}

prompt_notary_api_vars() {
  _missing="$(missing_notary_api_vars 2>/dev/null || true)"
  [ -n "$_missing" ] || return 0

  echo "" >&2
  echo "App Store Connect API notarization — missing:" >&2
  printf '%s' "$_missing" | sed 's/^/  /' >&2

  if ! is_interactive; then
    die "set APPLE_API_KEY, APPLE_API_ISSUER, and APPLE_API_KEY_PATH"
  fi

  [ -n "${APPLE_API_ISSUER:-}" ] || prompt_nonempty APPLE_API_ISSUER "APPLE_API_ISSUER"
  [ -n "${APPLE_API_KEY:-}" ] || prompt_nonempty APPLE_API_KEY "APPLE_API_KEY"
  [ -n "${APPLE_API_KEY_PATH:-}" ] || prompt_nonempty APPLE_API_KEY_PATH "APPLE_API_KEY_PATH"
  [ -f "${APPLE_API_KEY_PATH}" ] || die "APPLE_API_KEY_PATH not found: ${APPLE_API_KEY_PATH}"

  has_notary_api_key || die "notarization API credentials incomplete"
  echo "Notarization: API key ready." >&2
}

prompt_notary_password_vars() {
  _missing="$(missing_notary_password_vars 2>/dev/null || true)"
  [ -n "$_missing" ] || return 0

  echo "" >&2
  echo "Apple ID notarization — missing:" >&2
  printf '%s' "$_missing" | sed 's/^/  /' >&2
  echo "APPLE_PASSWORD = app-specific password (https://appleid.apple.com)" >&2

  if ! is_interactive; then
    die "set APPLE_ID, APPLE_PASSWORD, and APPLE_TEAM_ID"
  fi

  infer_team_from_signing_identity
  [ -n "${APPLE_ID:-}" ] || prompt_nonempty APPLE_ID "APPLE_ID"
  [ -n "${APPLE_TEAM_ID:-}" ] || prompt_nonempty APPLE_TEAM_ID "APPLE_TEAM_ID"
  [ -n "${APPLE_PASSWORD:-}" ] || prompt_nonempty APPLE_PASSWORD "APPLE_PASSWORD" 1

  has_notary_password || die "notarization credentials incomplete"
  echo "Notarization: ${APPLE_ID} team ${APPLE_TEAM_ID} (password set)." >&2
}

ensure_notarization() {
  if [ "$SKIP_NOTARIZE" -eq 1 ]; then
    echo "warning: --skip-notarize — signed only, not notarized." >&2
    return 0
  fi

  if has_notary_api_key; then
    echo "Notarization: API key ready." >&2
    return 0
  fi

  if has_notary_password; then
    echo "Notarization: Apple ID flow ready." >&2
    return 0
  fi

  _pwd_missing="$(missing_notary_password_vars 2>/dev/null || true)"
  _api_missing="$(missing_notary_api_vars 2>/dev/null || true)"

  if [ -n "$_api_missing" ] && [ -z "$_pwd_missing" ]; then
    prompt_notary_api_vars
    return 0
  fi

  if [ -n "$_pwd_missing" ] && [ -z "$_api_missing" ]; then
    prompt_notary_password_vars
    return 0
  fi

  echo "" >&2
  echo "warning: Notarization not fully configured (Tauri will skip notarization)." >&2
  [ -n "$_pwd_missing" ] && printf '%s' "$_pwd_missing" | sed 's/^/  missing: /' >&2
  [ -n "$_api_missing" ] && printf '%s' "$_api_missing" | sed 's/^/  missing: /' >&2

  if ! is_interactive; then
    die "notarization credentials missing"
  fi

  printf "Use App Store Connect API key? [y/N] "
  read -r _use_api
  _use_api="$(printf '%s' "${_use_api:-N}" | tr '[:upper:]' '[:lower:]')"
  case "$_use_api" in
    y|yes) prompt_notary_api_vars ;;
    *) prompt_notary_password_vars ;;
  esac
}

print_release_env_summary() {
  echo "" >&2
  echo "Release environment:" >&2
  echo "  APP_VERSION=${APP_VERSION}" >&2
  echo "  PRODUCT_NAME=${PRODUCT_NAME}" >&2
  echo "  Expected DMG: $(dmg_asset_basename)" >&2
  echo "  APPLE_SIGNING_IDENTITY=${APPLE_SIGNING_IDENTITY:-<not set>}" >&2
  if [ "$SKIP_NOTARIZE" -eq 1 ]; then
    echo "  Notarization: skipped" >&2
  elif has_notary_api_key; then
    echo "  Notarization: API ${APPLE_API_KEY}" >&2
  elif has_notary_password; then
    echo "  Notarization: ${APPLE_ID} team ${APPLE_TEAM_ID}" >&2
  else
    echo "  Notarization: incomplete" >&2
  fi
  if [ "$PUBLISH" -eq 1 ]; then
    echo "  Publish: GitHub ${GITHUB_REPO} tag $(release_tag_name)" >&2
    echo "  Homebrew tap: ${HOMEBREW_TAP_DIR}/Casks/warp12.rb" >&2
  fi
}

ensure_signing_identity
ensure_notarization
generate_developer_id_entitlements
print_release_env_summary

echo "Building frontend..."
yarn build:all

TAURI_LOCAL_CONF="$(warp_env_write_tauri_local_config)"

echo "Building universal DMG (Tauri)..."
cd "$BRIDGE_DIR"
# shellcheck disable=SC2086
"$TAURI_BIN" build \
  --target universal-apple-darwin \
  --bundles dmg \
  --config '{"build":{"beforeBuildCommand":""}}' \
  --config "$TAURI_LOCAL_CONF" \
  ${EXTRA_TAURI_ARGS}

echo "Done. DMG under ${DMG_DIR}/"
if [ -d "$DMG_DIR" ]; then
  _expected="$(dmg_asset_basename)"
  if [ -f "${DMG_DIR}/${_expected}" ]; then
    echo "  ${DMG_DIR}/${_expected}"
  else
    echo "  (newest .dmg:)"
    ls -1t "${DMG_DIR}"/*.dmg 2>/dev/null | head -3 || true
  fi
fi

if [ "$PUBLISH" -eq 1 ]; then
  echo ""
  echo "Publishing GitHub release and updating homebrew-tap..." >&2
  publish_github_and_homebrew
fi
