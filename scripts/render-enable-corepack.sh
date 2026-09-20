#!/usr/bin/env bash

# Enables Corepack and activates the pnpm version pinned in package.json.
#
# SOURCE this script rather than executing it. It prepends the shim directory to PATH, which
# only reaches the caller when sourced.
#
# Corepack installs its shims next to the `corepack` binary by default. On Render that resolves
# to /usr/bin on a read-only mount, so `corepack enable` fails with EROFS whenever the pnpm shim
# already there is not byte-for-byte the symlink Corepack wants to write. Whether it matches
# depends on if Render installed Node fresh or restored it from cache, which is not something we
# control. Installing the shims somewhere we own removes the dependency on the image layout.

set -euo pipefail

if ! (return 0 2>/dev/null); then
  echo "render-enable-corepack.sh must be sourced, not executed: source ${BASH_SOURCE[0]}" >&2
  exit 1
fi

PNPM_VERSION=$(node -p "require('./package.json').devEngines.packageManager.version")
COREPACK_BIN_DIR="${COREPACK_BIN_DIR:-${HOME:-/tmp}/.corepack/bin}"

mkdir -p "${COREPACK_BIN_DIR}"
corepack enable --install-directory "${COREPACK_BIN_DIR}"
export PATH="${COREPACK_BIN_DIR}:${PATH}"
corepack prepare "pnpm@${PNPM_VERSION}" --activate
