#!/usr/bin/env node
import 'dotenv/config';
import { $ } from 'zx';

const ROLLBAR_SERVER_TOKEN = process.env.ROLLBAR_SERVER_TOKEN;

if (!ROLLBAR_SERVER_TOKEN) {
  console.error('ROLLBAR_SERVER_TOKEN env variable is not set.');
  process.exit(1);
}

const VERSION = (await $`git rev-parse --short HEAD`).stdout.trim();
const FULL_VERSION = (await $`git describe --always --long`).stdout.trim();

const version = {
  environment: 'production',
  revision: VERSION,
  comment: FULL_VERSION,
};

const results =
  await $`curl https://api.rollbar.com/api/1/deploy -H "X-Rollbar-Access-Token: ${ROLLBAR_SERVER_TOKEN}" -H "Content-Type: application/json" -d ${JSON.stringify(
    version
  )}`;
