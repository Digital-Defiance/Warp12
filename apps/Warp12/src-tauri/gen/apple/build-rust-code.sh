#!/bin/bash
# Xcode "Build Rust Code" phase — login shells are not loaded, so node/cargo may be missing.
set -euo pipefail

export PATH="${HOME}/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"

if [ -s "${HOME}/.nvm/nvm.sh" ]; then
  # shellcheck source=/dev/null
  source "${HOME}/.nvm/nvm.sh"
  nvm use default >/dev/null 2>&1 || true
fi

if ! command -v node >/dev/null 2>&1; then
  for _node in \
    /opt/homebrew/bin/node \
    /usr/local/bin/node \
    "${HOME}/.nvm/versions/node/"*/bin/node; do
    if [ -x "${_node}" ]; then
      export PATH="$(dirname "${_node}"):${PATH}"
      break
    fi
  done
fi

if ! command -v node >/dev/null 2>&1; then
  echo "error: node not found — Xcode cannot see your shell PATH." >&2
  echo "Install Node (brew/nvm) or open the project from a terminal where 'node' works." >&2
  exit 1
fi

cd "$(dirname "$0")"

exec node tauri ios xcode-script -v \
  --platform "${PLATFORM_DISPLAY_NAME:?}" \
  --sdk-root "${SDKROOT:?}" \
  --framework-search-paths "${FRAMEWORK_SEARCH_PATHS:?}" \
  --header-search-paths "${HEADER_SEARCH_PATHS:?}" \
  --gcc-preprocessor-definitions "${GCC_PREPROCESSOR_DEFINITIONS:-}" \
  --configuration "${CONFIGURATION:?}" \
  ${FORCE_COLOR:-} \
  "${ARCHS:?}"
