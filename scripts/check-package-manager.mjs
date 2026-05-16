#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent ?? '';
const execPath = process.env.npm_execpath ?? '';

const isNpm = userAgent.startsWith('npm/') || /[\\/]npm-cli\.js$/i.test(execPath);
const isYarn = userAgent.startsWith('yarn/') || /[\\/]yarn(\.cjs|\.js)?$/i.test(execPath);

if (isNpm || isYarn) {
  console.error('This repository uses pnpm. Run `pnpm install` instead of npm or Yarn.');
  process.exit(1);
}
