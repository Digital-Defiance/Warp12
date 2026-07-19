#!/usr/bin/env bash
# Shared Warp12 environment loader (Bash 3.2+ / macOS default bash).
#
# Usage (from any first-party script):
#   # shellcheck source=scripts/lib/warp-env.sh
#   . "$(cd "$(dirname "$0")/.." && pwd)/scripts/lib/warp-env.sh"   # from scripts/
#   . "$(cd "$(dirname "$0")/../.." && pwd)/scripts/lib/warp-env.sh" # from tools/nn/
#   warp_env_load <mode>
#   warp_env_validate <mode>
#
# Precedence: process ENV (already set) > .env.local > .env > computed defaults.
# Never overwrites an already-exported variable. Does not execute .env contents.

# Refuse accidental execution as a main script.
if [ "${BASH_SOURCE[0]:-$0}" = "$0" ]; then
  echo "error: source scripts/lib/warp-env.sh; do not execute it" >&2
  exit 1
fi

# ---------------------------------------------------------------------------
# Internals
# ---------------------------------------------------------------------------

_warp_env_is_set() {
  # True if the named variable is set in the environment (even to empty).
  eval "[ \"\${$1+x}\" = x ]"
}

_warp_env_export_if_unset() {
  local key="$1"
  local value="$2"
  if _warp_env_is_set "$key"; then
    return 0
  fi
  # Expand $HOME / ~ only for path-like values that use them literally.
  case "$value" in
    \$HOME/*)
      value="${HOME}/${value#\$HOME/}"
      ;;
    \~/*)
      value="${HOME}/${value#\~/}"
      ;;
  esac
  export "$key=$value"
}

warp_env_die() {
  echo "error: $*" >&2
  exit 1
}

# ---------------------------------------------------------------------------
# Repo root
# ---------------------------------------------------------------------------

warp_env_repo_root() {
  if [ -n "${WARP12_ROOT:-}" ] && [ -d "${WARP12_ROOT}" ]; then
    printf '%s' "$WARP12_ROOT"
    return 0
  fi
  local here lib_dir candidate
  here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  # scripts/lib → repo root
  candidate="$(cd "${here}/../.." && pwd)"
  if [ -f "${candidate}/package.json" ] && [ -f "${candidate}/AGENTS.md" ]; then
    printf '%s' "$candidate"
    return 0
  fi
  # Walk up from caller if lib moved
  lib_dir="$here"
  while [ "$lib_dir" != "/" ]; do
    if [ -f "${lib_dir}/package.json" ] && [ -f "${lib_dir}/AGENTS.md" ]; then
      printf '%s' "$lib_dir"
      return 0
    fi
    lib_dir="$(cd "${lib_dir}/.." && pwd)"
  done
  warp_env_die "could not resolve Warp12 repository root (set WARP12_ROOT)"
}

# ---------------------------------------------------------------------------
# Safe KEY=VALUE file load (process ENV wins)
# ---------------------------------------------------------------------------

warp_env_load_file() {
  local path="$1"
  [ -f "$path" ] || return 0

  local line key value stripped
  # IFS= read preserves leading/trailing spaces in value before we strip.
  while IFS= read -r line || [ -n "$line" ]; do
    # Strip CR (Windows)
    line="${line%$'\r'}"
    # Trim leading whitespace (Bash 3.2-safe)
    stripped="$line"
    while [ "${stripped#"${stripped%%[![:space:]]*}"}" != "$stripped" ]; do
      stripped="${stripped#"${stripped%%[![:space:]]*}"}"
    done
    [ -z "$stripped" ] && continue
    case "$stripped" in
      \#*) continue ;;
    esac
    case "$stripped" in
      *=*) ;;
      *) continue ;;
    esac
    key="${stripped%%=*}"
    value="${stripped#*=}"
    # Trim key
    while [ "${key%"${key##*[![:space:]]}"}" != "$key" ]; do
      key="${key%"${key##*[![:space:]]}"}"
    done
    while [ "${key#"${key%%[![:space:]]*}"}" != "$key" ]; do
      key="${key#"${key%%[![:space:]]*}"}"
    done
    [ -z "$key" ] && continue
    # Reject unsafe keys / values (no command substitution)
    case "$key" in
      *[!A-Za-z0-9_]* ) continue ;;
    esac
    case "$value" in
      *'`'* | *'$('* | *'${'* ) continue ;;
    esac
    # Strip matching surrounding quotes
    if [ "${#value}" -ge 2 ]; then
      case "$value" in
        \"*\") value="${value#\"}"; value="${value%\"}" ;;
        \'*\') value="${value#\'}"; value="${value%\'}" ;;
      esac
    fi
    _warp_env_export_if_unset "$key" "$value"
  done < "$path"
}

# ---------------------------------------------------------------------------
# CPU-aware defaults
# ---------------------------------------------------------------------------

warp_env_ncpu() {
  local n=""
  if command -v sysctl >/dev/null 2>&1; then
    n="$(sysctl -n hw.ncpu 2>/dev/null || true)"
  fi
  if [ -z "$n" ] && command -v nproc >/dev/null 2>&1; then
    n="$(nproc 2>/dev/null || true)"
  fi
  if [ -z "$n" ]; then
    n="$(getconf _NPROCESSORS_ONLN 2>/dev/null || true)"
  fi
  case "$n" in
    '' | *[!0-9]*) n=4 ;;
  esac
  printf '%s' "$n"
}

warp_env_default_workers() {
  local reserve="${1:-2}"
  local ncpu workers
  ncpu="$(warp_env_ncpu)"
  workers=$((ncpu - reserve))
  if [ "$workers" -lt 1 ]; then
    workers=1
  fi
  printf '%s' "$workers"
}

warp_env_apply_cpu_defaults() {
  local default_workers
  default_workers="$(warp_env_default_workers "${WARP_ENV_WORKER_RESERVE:-2}")"
  _warp_env_export_if_unset MODULE_WORKERS "$default_workers"
  _warp_env_export_if_unset COMPREHENSIVE_WORKERS "$default_workers"
  _warp_env_export_if_unset OMEGA_WORKERS "$default_workers"
  _warp_env_export_if_unset AI_BENCH_WORKERS "$default_workers"
}

# ---------------------------------------------------------------------------
# Layered load by mode
# ---------------------------------------------------------------------------

warp_env_load() {
  local mode="${1:-base}"
  local root
  root="$(warp_env_repo_root)"
  export WARP12_ROOT="$root"

  # Root env layers
  warp_env_load_file "${root}/.env"
  warp_env_load_file "${root}/.env.local"

  case "$mode" in
    base | train | calibrate | macos | macos-appstore | ios | publish | e2e)
      ;;
    bridge | android | ios-oauth)
      warp_env_load_file "${root}/apps/Warp12/.env"
      warp_env_load_file "${root}/apps/Warp12/.env.local"
      ;;
    functions | deploy)
      warp_env_load_file "${root}/functions/.env"
      warp_env_load_file "${root}/functions/.env.local"
      ;;
    *)
      warp_env_die "unknown warp_env_load mode: ${mode}"
      ;;
  esac

  case "$mode" in
    train | calibrate | base)
      warp_env_apply_cpu_defaults
      ;;
  esac

  # Derived Apple identity helpers (only when unset)
  if [ -n "${APPLE_TEAM_ID:-}" ] && [ -n "${APPLE_PUBLISHER_NAME:-}" ]; then
    _warp_env_export_if_unset \
      APPLE_IOS_SIGN_IDENTITY \
      "Apple Distribution: ${APPLE_PUBLISHER_NAME} (${APPLE_TEAM_ID})"
    _warp_env_export_if_unset \
      DEFAULT_DEVELOPER_ID_TEAM \
      "$APPLE_TEAM_ID"
  fi

  # Default API key path from APPLE_API_KEY + APPLE_API_KEY_DIR
  if [ -n "${APPLE_API_KEY:-}" ] && [ -z "${APPLE_API_KEY_PATH:-}" ]; then
    local key_dir="${APPLE_API_KEY_DIR:-$HOME/private_keys}"
    case "$key_dir" in
      \$HOME/*) key_dir="${HOME}/${key_dir#\$HOME/}" ;;
      \~/*) key_dir="${HOME}/${key_dir#\~/}" ;;
    esac
    if [ -f "${key_dir}/AuthKey_${APPLE_API_KEY}.p8" ]; then
      _warp_env_export_if_unset APPLE_API_KEY_PATH "${key_dir}/AuthKey_${APPLE_API_KEY}.p8"
    fi
  fi
}

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

warp_env_require() {
  local missing=0
  local var val
  for var in "$@"; do
    eval "val=\"\${$var:-}\""
    if [ -z "$val" ]; then
      echo "error: required environment variable ${var} is unset or empty" >&2
      echo "  Set it in the process environment or in ${WARP12_ROOT:-.}/.env (see .env.example)" >&2
      missing=1
    fi
  done
  [ "$missing" -eq 0 ] || exit 1
}

warp_env_require_file() {
  local path
  for path in "$@"; do
    [ -f "$path" ] || warp_env_die "required file missing: ${path}"
  done
}

warp_env_require_positive_int() {
  local var="$1"
  local val
  eval "val=\"\${$var:-}\""
  case "$val" in
    '' | *[!0-9]* | 0)
      warp_env_die "${var} must be a positive integer (got: '${val}')"
      ;;
  esac
}

warp_env_validate() {
  local mode="${1:-base}"
  case "$mode" in
    base | train | calibrate)
      ;;
    macos)
      warp_env_require APPLE_TEAM_ID APPLE_BUNDLE_ID APPLE_PUBLISHER_NAME
      ;;
    macos-appstore)
      warp_env_require APPLE_TEAM_ID APPLE_BUNDLE_ID APPLE_PUBLISHER_NAME
      ;;
    ios)
      warp_env_require APPLE_TEAM_ID APPLE_BUNDLE_ID APPLE_PUBLISHER_NAME
      ;;
    android)
      warp_env_require APPLE_BUNDLE_ID
      ;;
    deploy | functions)
      warp_env_require FIREBASE_PROJECT
      case "${FIREBASE_PROJECT}" in
        demo-*)
          warp_env_die "FIREBASE_PROJECT=${FIREBASE_PROJECT} looks like an emulator project; refusing production deploy"
          ;;
      esac
      ;;
    publish)
      warp_env_require GITHUB_REPO HOMEBREW_TAP_DIR
      ;;
    bridge)
      warp_env_require VITE_FIREBASE_PROJECT_ID
      ;;
    e2e)
      _warp_env_export_if_unset FIREBASE_E2E_PROJECT "demo-warp12"
      ;;
    *)
      warp_env_die "unknown warp_env_validate mode: ${mode}"
      ;;
  esac
}

# ---------------------------------------------------------------------------
# Convenience: cd to root + resolve relative artifact paths
# ---------------------------------------------------------------------------

warp_env_cd_root() {
  local root
  root="$(warp_env_repo_root)"
  export WARP12_ROOT="$root"
  cd "$root" || warp_env_die "cd ${root} failed"
}

warp_env_abs_path() {
  # Resolve a path relative to WARP12_ROOT (or leave absolute paths alone).
  local p="$1"
  case "$p" in
    /*) printf '%s' "$p" ;;
    \$HOME/*) printf '%s' "${HOME}/${p#\$HOME/}" ;;
    \~/*) printf '%s' "${HOME}/${p#\~/}" ;;
    *) printf '%s' "${WARP12_ROOT:-.}/${p}" ;;
  esac
}

# Generate ignored Tauri override JSON from current env (Node helper).
# Prints a single absolute path on stdout (no trailing newline issues for --config).
warp_env_write_tauri_local_config() {
  local root helper out
  root="$(warp_env_repo_root)"
  helper="${root}/scripts/tauri-config-from-env.mjs"
  out="${root}/apps/Warp12/src-tauri/tauri.conf.local.json"
  [ -f "$helper" ] || warp_env_die "missing ${helper}"
  # Node may echo the path; discard it so callers only get one clean value from printf.
  node "$helper" --write "$out" >/dev/null || warp_env_die "failed to write ${out}"
  [ -f "$out" ] || warp_env_die "missing generated config: ${out}"
  printf '%s' "$out"
}
