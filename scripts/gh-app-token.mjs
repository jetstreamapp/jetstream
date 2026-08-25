#!/usr/bin/env node

/**
 * Mint a GitHub App installation token so CLI tooling (and AI agents) can post PR comments and
 * reviews as the App's bot account instead of a personal account. Uses the same GitHub App that
 * the release workflow uses (.github/workflows/release.yml).
 *
 * Setup (one time):
 *   1. In the GitHub App settings (https://github.com/organizations/jetstreamapp/settings/apps),
 *      make sure the App has "Pull requests: Read and write" and "Issues: Read and write"
 *      repository permissions, then generate/download a private key (.pem).
 *   2. Store the .pem outside the repo (e.g. ~/.config/jetstream/gh-app.pem) with mode 0600.
 *   3. Fill in the GH_BOT_* variables in `.env` (see `--help`).
 *
 * Usage:
 *   pnpm gh:bot token                                  # print an installation token
 *   pnpm gh:bot whoami                                 # print the bot login the token acts as
 *   pnpm gh:bot run gh pr comment 123 --body "..."     # run a command with GH_TOKEN set to the app token
 */

import { spawnSync } from 'node:child_process';
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_CACHE_FILE = join(ROOT_DIR, 'tmp', 'gh-app-token', '.token-cache.json');
/** Installation tokens live for 1 hour - refresh with headroom so a token never dies mid-command. */
const TOKEN_CACHE_TTL_MS = 1000 * 60 * 50;
/** Only ask for what commenting/reviewing needs - the token cannot push code or cut releases. */
const REQUESTED_PERMISSIONS = { pull_requests: 'write', issues: 'write' };

dotenv.config({ path: join(ROOT_DIR, '.env'), quiet: true });

const HELP = `
Mint a GitHub App installation token to act as the App's bot account.

Usage:
  pnpm gh:bot token             Print an installation token (also the default command)
  pnpm gh:bot whoami            Print the bot login and the permissions the token carries
  pnpm gh:bot run <cmd...>      Run <cmd> with GH_TOKEN/GITHUB_TOKEN set to the app token
  pnpm gh:bot clear-cache       Delete the cached token

Environment variables (in .env):
  GH_BOT_CLIENT_ID              GitHub App client ID (same app as the release workflow)
  GH_BOT_PRIVATE_KEY_PATH       Path to the app's private key .pem file, or
  GH_BOT_PRIVATE_KEY_BASE64     Base64 encoded private key PEM
  GH_BOT_REPO                   Optional owner/repo override (defaults to the git origin remote)
`;

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function getPrivateKey() {
  const { GH_BOT_PRIVATE_KEY_BASE64, GH_BOT_PRIVATE_KEY_PATH } = process.env;
  if (GH_BOT_PRIVATE_KEY_BASE64) {
    return Buffer.from(GH_BOT_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  }
  if (GH_BOT_PRIVATE_KEY_PATH) {
    const keyPath = resolve(ROOT_DIR, GH_BOT_PRIVATE_KEY_PATH.replace(/^~(?=\/)/, process.env.HOME ?? '~'));
    if (!existsSync(keyPath)) {
      fail(`GH_BOT_PRIVATE_KEY_PATH points to a missing file: ${keyPath}`);
    }
    return readFileSync(keyPath, 'utf8');
  }
  fail('Set GH_BOT_PRIVATE_KEY_PATH or GH_BOT_PRIVATE_KEY_BASE64 in .env (run with --help for setup).');
}

function getRepo() {
  if (process.env.GH_BOT_REPO) {
    return process.env.GH_BOT_REPO;
  }
  const remote = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT_DIR, encoding: 'utf8' });
  const match = remote.stdout?.trim().match(/github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/);
  if (!match) {
    fail('Could not determine owner/repo from the git origin remote - set GH_BOT_REPO in .env.');
  }
  return match[1];
}

function base64Url(input) {
  return Buffer.from(input).toString('base64url');
}

function buildAppJwt(clientId, privateKey) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  // iat is backdated to tolerate clock drift; GitHub caps exp at 10 minutes out.
  const payload = base64Url(JSON.stringify({ iat: nowSeconds - 60, exp: nowSeconds + 9 * 60, iss: clientId }));
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey, 'base64url');
  return `${header}.${payload}.${signature}`;
}

async function githubApi(path, { method = 'GET', token, body } = {}) {
  const options = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
  if (body) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }
  const response = await fetch(`https://api.github.com${path}`, options);
  const responseBody = await response.json().catch(() => ({}));
  return { response, responseBody };
}

function readTokenCache(repo) {
  try {
    const cache = JSON.parse(readFileSync(TOKEN_CACHE_FILE, 'utf8'));
    if (cache.repo === repo && cache.createdAt + TOKEN_CACHE_TTL_MS > Date.now()) {
      return cache;
    }
  } catch {
    // Missing or unparseable cache just means we authenticate again.
  }
  return null;
}

function writeTokenCache(cache) {
  mkdirSync(dirname(TOKEN_CACHE_FILE), { recursive: true });
  writeFileSync(TOKEN_CACHE_FILE, JSON.stringify(cache), { mode: 0o600 });
}

async function getInstallationToken() {
  const repo = getRepo();
  const cached = readTokenCache(repo);
  if (cached) {
    return cached;
  }

  const clientId = process.env.GH_BOT_CLIENT_ID;
  if (!clientId) {
    fail('Set GH_BOT_CLIENT_ID in .env (run with --help for setup).');
  }
  const appJwt = buildAppJwt(clientId, getPrivateKey());

  const installation = await githubApi(`/repos/${repo}/installation`, { token: appJwt });
  if (!installation.response.ok) {
    fail(
      `Could not find an installation of the app on ${repo} (HTTP ${installation.response.status}: ${installation.responseBody.message}). ` +
        'Check GH_BOT_CLIENT_ID and that the app is installed on the repository.',
    );
  }

  const tokenResult = await githubApi(`/app/installations/${installation.responseBody.id}/access_tokens`, {
    method: 'POST',
    token: appJwt,
    body: { repositories: [repo.split('/')[1]], permissions: REQUESTED_PERMISSIONS },
  });
  if (!tokenResult.response.ok) {
    fail(
      `Could not create an installation token (HTTP ${tokenResult.response.status}: ${tokenResult.responseBody.message}). ` +
        'If this is a permissions error, grant the app "Pull requests: Read and write" and "Issues: Read and write" ' +
        'in its settings, then accept the updated permissions on the installation.',
    );
  }

  const appSlug = installation.responseBody.app_slug;
  const cache = {
    repo,
    token: tokenResult.responseBody.token,
    botLogin: `${appSlug}[bot]`,
    permissions: tokenResult.responseBody.permissions,
    createdAt: Date.now(),
  };
  writeTokenCache(cache);
  return cache;
}

async function main() {
  const [command = 'token', ...args] = process.argv.slice(2);

  if (command === '--help' || command === '-h' || command === 'help') {
    console.log(HELP);
    return;
  }

  if (command === 'clear-cache') {
    rmSync(TOKEN_CACHE_FILE, { force: true });
    console.log('Token cache cleared.');
    return;
  }

  const { token, botLogin, permissions } = await getInstallationToken();

  switch (command) {
    case 'token': {
      console.log(token);
      return;
    }
    case 'whoami': {
      console.log(`Acting as: ${botLogin}`);
      console.log(`Token permissions: ${JSON.stringify(permissions)}`);
      return;
    }
    case 'run': {
      // pnpm strips the first `--`, but tolerate an explicit one: `pnpm gh:bot run -- gh ...`
      const commandArgs = args[0] === '--' ? args.slice(1) : args;
      if (commandArgs.length === 0) {
        fail('No command provided. Usage: pnpm gh:bot run gh pr comment 123 --body "..."');
      }
      const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
        stdio: 'inherit',
        env: { ...process.env, GH_TOKEN: token, GITHUB_TOKEN: token },
      });
      process.exit(result.status ?? 1);
      return;
    }
    default: {
      fail(`Unknown command "${command}". Run with --help for usage.`);
    }
  }
}

main().catch((error) => fail(error.message));
