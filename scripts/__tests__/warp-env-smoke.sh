#!/usr/bin/env bash
# Smoke / unit checks for scripts/lib/warp-env.sh (Bash 3.2+).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck source=scripts/lib/warp-env.sh
. "${ROOT}/scripts/lib/warp-env.sh"

TMP="$(mktemp -d "${TMPDIR:-/tmp}/warp-env-test.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT

fail=0
assert_eq() {
  local label="$1" expected="$2" actual="$3"
  if [ "$expected" != "$actual" ]; then
    echo "FAIL: ${label}: expected '${expected}' got '${actual}'" >&2
    fail=1
  else
    echo "ok: ${label}"
  fi
}

# Process ENV wins over file
export WARP_ENV_TEST_A="from-process"
printf 'WARP_ENV_TEST_A=from-file\nWARP_ENV_TEST_B=file-b\n' > "${TMP}/t.env"
unset WARP_ENV_TEST_B || true
warp_env_load_file "${TMP}/t.env"
assert_eq "process wins" "from-process" "${WARP_ENV_TEST_A}"
assert_eq "file fills unset" "file-b" "${WARP_ENV_TEST_B}"

# Reject command substitution
printf 'WARP_ENV_TEST_BAD=$(whoami)\n' > "${TMP}/bad.env"
unset WARP_ENV_TEST_BAD || true
warp_env_load_file "${TMP}/bad.env"
assert_eq "reject \$()" "" "${WARP_ENV_TEST_BAD:-}"

# Repo root
resolved="$(warp_env_repo_root)"
assert_eq "repo root" "$ROOT" "$resolved"

# Workers are positive
workers="$(warp_env_default_workers 2)"
case "$workers" in
  '' | *[!0-9]* | 0)
    echo "FAIL: workers not positive: ${workers}" >&2
    fail=1
    ;;
  *)
    echo "ok: default workers=${workers}"
    ;;
esac

# Tauri config generator requires bundle id
if APPLE_BUNDLE_ID="org.example.test.app" APPLE_TEAM_ID="ABCDE12345" \
  APPLE_PUBLISHER_NAME="Example Org" \
  node "${ROOT}/scripts/tauri-config-from-env.mjs" --print | grep -q 'org.example.test.app'; then
  echo "ok: tauri-config-from-env prints bundle id"
else
  echo "FAIL: tauri-config-from-env" >&2
  fail=1
fi

# warp_env_write_tauri_local_config must return a single path (no doubled stdout)
_cfg="$(
  APPLE_BUNDLE_ID="org.example.test.app" \
  APPLE_TEAM_ID="ABCDE12345" \
  APPLE_PUBLISHER_NAME="Example Org" \
  warp_env_write_tauri_local_config
)"
case "$_cfg" in
  *$'\n'*)
    echo "FAIL: warp_env_write_tauri_local_config returned multiline: $(printf '%q' "$_cfg")" >&2
    fail=1
    ;;
  *)
    if [ -f "$_cfg" ]; then
      echo "ok: warp_env_write_tauri_local_config → ${_cfg}"
    else
      echo "FAIL: missing generated config ${_cfg}" >&2
      fail=1
    fi
    ;;
esac

exit "$fail"
