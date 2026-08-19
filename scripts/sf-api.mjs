#!/usr/bin/env node

/**
 * Make real Salesforce API calls from the command line (or from an AI agent) against a personal
 * dev org, authenticated with the OAuth 2.0 JWT bearer flow so there is no interactive login.
 *
 * Setup (one time):
 *   1. Generate a key pair - `openssl req -x509 -sha256 -nodes -days 3650 -newkey rsa:2048 \
 *        -keyout tmp/salesforce-jwt/jetstream-local.key -out tmp/salesforce-jwt/jetstream-local.crt \
 *        -subj "/CN=jetstream-local-agent"`
 *   2. Create a connected app in the org, enable OAuth, upload the `.crt` as the digital certificate,
 *      check "Use digital signatures", and select the `api`, `refresh_token`, `offline_access` scopes.
 *   3. Pre-authorize the running user: Manage Connected App -> Permitted Users = "Admin approved users
 *      are pre-authorized", then assign a profile or permission set.
 *   4. Fill in the SF_LOCAL_* variables in `.env` (see `--help`).
 *
 * Usage:
 *   pnpm sf:api query "SELECT Id, Name FROM Account LIMIT 5"
 *   pnpm sf:api query "SELECT Id FROM ApexClass" --tooling
 *   pnpm sf:api get sobjects/Account/describe
 *   pnpm sf:api post sobjects/Account '{"Name":"Test Account"}'
 *   pnpm sf:api patch sobjects/Account/001xx000003DGb2AAG '{"Name":"Renamed"}'
 *   pnpm sf:api delete sobjects/Account/001xx000003DGb2AAG
 *   pnpm sf:api token
 */

import dotenv from 'dotenv';
import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TOKEN_CACHE_FILE = join(ROOT_DIR, 'tmp', 'salesforce-jwt', '.token-cache.json');
/** Salesforce sessions live far longer than this, we just avoid re-authenticating on every call. */
const TOKEN_CACHE_TTL_MS = 1000 * 60 * 30;

dotenv.config({ path: join(ROOT_DIR, '.env'), quiet: true });

const HELP = `
sf-api - call the Salesforce REST API using the JWT bearer flow

Commands:
  token                          Fetch an access token and print it with the instance url
  query <soql>                   Run a SOQL query
  get <path>                     GET request
  post <path> <body>             POST request
  patch <path> <body>            PATCH request
  put <path> <body>              PUT request
  delete <path>                  DELETE request

Paths may be a full url, an absolute path (/services/data/v67.0/...), or a short path
(sobjects/Account/describe) which is prefixed with /services/data/<version>/ automatically.

Bodies may be inline JSON, @path/to/file.json, or - to read stdin.

Options:
  --tooling                      Use the Tooling API (query + short paths)
  --all                          query: follow nextRecordsUrl until every record is retrieved
  --all-rows                     query: use queryAll (includes deleted/archived records)
  --records                      query: print only the records array
  --no-cache                     Ignore the cached access token and re-authenticate
  --raw                          Print the response body without pretty printing
  --help                         Show this message

Environment variables (in .env):
  SF_LOCAL_USERNAME              Required. Username of the pre-authorized user
  SF_LOCAL_CLIENT_ID             Required. Connected app consumer key
  SF_LOCAL_PRIVATE_KEY_BASE64    Required. Base64 encoded private key PEM
                                 (or SF_LOCAL_PRIVATE_KEY_PATH pointing at the .key file)
  SF_LOCAL_INSTANCE_URL          Optional. Overrides the instance url returned by the token request
  SF_LOCAL_LOGIN_URL             Optional. Defaults to https://login.salesforce.com
                                 (use https://test.salesforce.com for sandboxes)
  SF_LOCAL_API_VERSION           Optional. Defaults to v67.0
  SF_LOCAL_CLIENT_SECRET         Unused - the JWT flow authenticates with the signed assertion
`;

function fail(message) {
  console.error(message);
  process.exit(1);
}

function parseArgs(argv) {
  const flags = new Set();
  const positional = [];
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      flags.add(arg.slice(2));
    } else {
      positional.push(arg);
    }
  }
  return { flags, positional };
}

function getPrivateKey() {
  const { SF_LOCAL_PRIVATE_KEY_BASE64, SF_LOCAL_PRIVATE_KEY_PATH } = process.env;
  if (SF_LOCAL_PRIVATE_KEY_BASE64) {
    // Allow either a base64 blob or a PEM pasted directly into the variable
    return SF_LOCAL_PRIVATE_KEY_BASE64.includes('BEGIN')
      ? SF_LOCAL_PRIVATE_KEY_BASE64
      : Buffer.from(SF_LOCAL_PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  }
  if (SF_LOCAL_PRIVATE_KEY_PATH) {
    return readFileSync(resolve(ROOT_DIR, SF_LOCAL_PRIVATE_KEY_PATH), 'utf8');
  }
  return fail('Missing SF_LOCAL_PRIVATE_KEY_BASE64 (or SF_LOCAL_PRIVATE_KEY_PATH) - see --help');
}

function base64Url(value) {
  return Buffer.from(value).toString('base64url');
}

function buildAssertion({ clientId, username, loginUrl, privateKey }) {
  const header = base64Url(JSON.stringify({ alg: 'RS256' }));
  const claims = base64Url(
    JSON.stringify({
      iss: clientId,
      sub: username,
      aud: loginUrl,
      exp: Math.floor(Date.now() / 1000) + 180,
    }),
  );
  const signature = createSign('RSA-SHA256').update(`${header}.${claims}`).end().sign(privateKey, 'base64url');
  return `${header}.${claims}.${signature}`;
}

function readTokenCache() {
  if (!existsSync(TOKEN_CACHE_FILE)) {
    return null;
  }
  try {
    const cached = JSON.parse(readFileSync(TOKEN_CACHE_FILE, 'utf8'));
    return Date.now() - cached.issuedAt < TOKEN_CACHE_TTL_MS ? cached : null;
  } catch {
    return null;
  }
}

function writeTokenCache(session) {
  mkdirSync(dirname(TOKEN_CACHE_FILE), { recursive: true });
  writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({ ...session, issuedAt: Date.now() }, null, 2), { mode: 0o600 });
}

function clearTokenCache() {
  rmSync(TOKEN_CACHE_FILE, { force: true });
}

async function authenticate({ useCache }) {
  if (useCache) {
    const cached = readTokenCache();
    if (cached) {
      return { accessToken: cached.accessToken, instanceUrl: cached.instanceUrl };
    }
  }

  const username = process.env.SF_LOCAL_USERNAME;
  const clientId = process.env.SF_LOCAL_CLIENT_ID;
  if (!username) {
    fail('Missing SF_LOCAL_USERNAME - see --help');
  }
  if (!clientId) {
    fail('Missing SF_LOCAL_CLIENT_ID - see --help');
  }
  const loginUrl = (process.env.SF_LOCAL_LOGIN_URL || 'https://login.salesforce.com').replace(/\/$/, '');
  const assertion = buildAssertion({ clientId, username, loginUrl, privateKey: getPrivateKey() });

  const response = await fetch(`${loginUrl}/services/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  });
  const body = await response.text();

  if (!response.ok) {
    fail(
      `Authentication failed (${response.status}): ${body}\n\n` +
        'Common causes: the certificate was not uploaded to the connected app, the user is not pre-authorized, ' +
        'or SF_LOCAL_LOGIN_URL points at the wrong environment.',
    );
  }

  const { access_token, instance_url } = JSON.parse(body);
  const session = {
    accessToken: access_token,
    instanceUrl: (process.env.SF_LOCAL_INSTANCE_URL || instance_url).replace(/\/$/, ''),
  };
  writeTokenCache(session);
  return session;
}

function buildUrl({ instanceUrl, path, isTooling }) {
  if (path.startsWith('http')) {
    return path;
  }
  if (path.startsWith('/services/')) {
    return `${instanceUrl}${path}`;
  }
  const apiVersion = process.env.SF_LOCAL_API_VERSION || 'v67.0';
  const prefix = `/services/data/${apiVersion}${isTooling ? '/tooling' : ''}`;
  return `${instanceUrl}${prefix}/${path.replace(/^\//, '')}`;
}

function readBody(input) {
  if (!input) {
    return undefined;
  }
  if (input === '-') {
    return readFileSync(0, 'utf8');
  }
  if (input.startsWith('@')) {
    return readFileSync(resolve(process.cwd(), input.slice(1)), 'utf8');
  }
  return input;
}

/** Retries once without the cached token, since a cached session may have been invalidated server side. */
async function request({ method, url, body, session, useCache, isRetry = false }) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    // Only include a body when there is one - fetch rejects a body on GET/DELETE
    ...(body ? { body } : {}),
  });

  if (response.status === 401 && useCache && !isRetry) {
    clearTokenCache();
    const freshSession = await authenticate({ useCache: false });
    return request({
      method,
      url: url.replace(session.instanceUrl, freshSession.instanceUrl),
      body,
      session: freshSession,
      useCache,
      isRetry: true,
    });
  }

  const text = await response.text();
  if (!response.ok) {
    console.error(`${method} ${url} failed with ${response.status} ${response.statusText}`);
    fail(text);
  }
  return { text, session };
}

function print(text, { raw }) {
  if (!text) {
    return;
  }
  if (raw) {
    console.log(text);
    return;
  }
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text);
  }
}

async function runQuery({ soql, session, flags, useCache }) {
  const endpoint = flags.has('all-rows') ? 'queryAll' : 'query';
  const isTooling = flags.has('tooling');
  let url = buildUrl({ instanceUrl: session.instanceUrl, path: `${endpoint}?q=${encodeURIComponent(soql)}`, isTooling });
  let currentSession = session;
  let result = null;

  while (url) {
    const response = await request({ method: 'GET', url, session: currentSession, useCache });
    currentSession = response.session;
    const page = JSON.parse(response.text);
    result = result ? { ...page, records: [...result.records, ...page.records] } : page;
    url = flags.has('all') && !page.done && page.nextRecordsUrl ? `${currentSession.instanceUrl}${page.nextRecordsUrl}` : null;
  }

  print(JSON.stringify(flags.has('records') ? result.records : result), { raw: flags.has('raw') });
}

async function main() {
  const { flags, positional } = parseArgs(process.argv.slice(2));
  const [command, ...args] = positional;

  if (!command || flags.has('help')) {
    console.log(HELP);
    return;
  }

  const useCache = !flags.has('no-cache');
  const session = await authenticate({ useCache });

  if (command === 'token') {
    print(JSON.stringify(session), { raw: flags.has('raw') });
    return;
  }

  if (command === 'query') {
    const [soql] = args;
    if (!soql) {
      fail('A SOQL query is required: sf-api query "SELECT Id FROM Account"');
    }
    await runQuery({ soql, session, flags, useCache });
    return;
  }

  const methodsByCommand = { get: 'GET', post: 'POST', patch: 'PATCH', put: 'PUT', delete: 'DELETE' };
  const method = methodsByCommand[command];
  if (!method) {
    fail(`Unknown command "${command}" - run with --help to see the available commands`);
  }

  const [path, rawBody] = args;
  if (!path) {
    fail(`A path is required: sf-api ${command} sobjects/Account`);
  }
  if (['POST', 'PATCH', 'PUT'].includes(method) && !rawBody) {
    fail(`A request body is required: sf-api ${command} ${path} '{"Name":"Example"}' - use '{}' if the endpoint takes an empty body`);
  }

  const url = buildUrl({ instanceUrl: session.instanceUrl, path, isTooling: flags.has('tooling') });
  const { text } = await request({ method, url, body: readBody(rawBody), session, useCache });
  print(text, { raw: flags.has('raw') });
}

main().catch((error) => fail(error.stack || error.message));
