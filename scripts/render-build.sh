#!/usr/bin/env bash

# Use this script to build the render package for production.
# It sources the Corepack helper (which puts the pinned pnpm on PATH), then installs
# dependencies and runs the build script.
# Examples:
#   ./scripts/render-build.sh
#   ./scripts/render-build.sh build:cron

set -euo pipefail

# shellcheck source=./render-enable-corepack.sh
source "$(dirname "$0")/render-enable-corepack.sh"

pnpm install --prod=false

# pnpm puts node_modules/.bin ahead of everything else when it runs a script, so a nested
# `pnpm ...` inside package.json (build:landing calls one) resolves there before it reaches our
# shim on PATH. Point it at the Corepack shim so nested calls cannot fall back to the pnpm the
# image ships, which engineStrict then rejects against this lockfile. The directory only exists
# once install has run. The echo reports what a nested call actually resolves to.
mkdir -p node_modules/.bin
ln -sf "${COREPACK_BIN_DIR}/pnpm" node_modules/.bin/pnpm
echo "corepack: nested pnpm -> $(pnpm -s exec sh -c 'command -v pnpm && pnpm --version' 2>/dev/null | tr '\n' ' ' || true)"

pnpm "${1:-build}"
