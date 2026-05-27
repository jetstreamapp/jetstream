#!/usr/bin/env bash

# Use this script to build the render package for production.
# It ensures Corepack is enabled and the correct version of pnpm is used, then installs dependencies and runs the build script.
# Examples:
#   ./scripts/render-build.sh
#   ./scripts/render-build.sh build:cron

set -euo pipefail

"$(dirname "$0")/render-enable-corepack.sh"

pnpm install --prod=false
pnpm "${1:-build}"
