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
pnpm "${1:-build}"
