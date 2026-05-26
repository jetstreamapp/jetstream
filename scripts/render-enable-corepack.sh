#!/usr/bin/env bash
set -euo pipefail

PNPM_VERSION=$(node -p "require('./package.json').devEngines.packageManager.version")

corepack enable
corepack prepare "pnpm@${PNPM_VERSION}" --activate
