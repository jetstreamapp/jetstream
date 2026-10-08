#!/usr/bin/env node

import { readFileSync } from 'node:fs';

const userAgent = process.env.npm_config_user_agent ?? '';
const execPath = process.env.npm_execpath ?? '';

const isNpm = userAgent.startsWith('npm/') || /[\\/]npm-cli\.js$/i.test(execPath);
const isYarn = userAgent.startsWith('yarn/') || /[\\/]yarn(\.cjs|\.js)?$/i.test(execPath);

if (isNpm || isYarn) {
  console.error('This repository uses pnpm. Run `pnpm install` instead of npm or Yarn.');
  process.exit(1);
}

// `pmOnFail: ignore` (pnpm-workspace.yaml) stops pnpm from switching itself to the pinned version, so a
// different pnpm would otherwise run silently and could rewrite the lockfile in another shape.
const runningVersion = userAgent.match(/^pnpm\/(\S+)/)?.[1];
const { packageManager } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const pinnedVersion = packageManager?.match(/^pnpm@([^+]+)/)?.[1];

if (runningVersion && pinnedVersion && runningVersion !== pinnedVersion) {
  console.error(
    `This repository is pinned to pnpm ${pinnedVersion}, but pnpm ${runningVersion} is running. ` +
      'Run `corepack enable` so the pinned version is used.',
  );
  process.exit(1);
}
