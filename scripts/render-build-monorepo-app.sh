#!/usr/bin/env bash

# Use this script to build a nested workspace project (e.g. docs, apps-sfdx) on Render.
# It ensures Corepack is enabled and the correct version of pnpm is used, then installs
# the target project's dependencies (plus its workspace deps) and runs its build script.
# Examples:
#   ./scripts/render-build-monorepo-app.sh docs
#   ./scripts/render-build-monorepo-app.sh apps-sfdx build

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <project-filter> [script]" >&2
  exit 1
fi

PROJECT="$1"
SCRIPT="${2:-build}"

"$(dirname "$0")/render-enable-corepack.sh"

pnpm install --prod=false --filter "${PROJECT}..."
pnpm --filter "${PROJECT}" "${SCRIPT}"

