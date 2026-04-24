#!/usr/bin/env node
// Generates a throwaway self-signed cert + key for the local mock SAML IdP,
// plus a saml.env file consumed by docker-compose. Outputs into ./saml-keys/
// which is gitignored — never commit these.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const keysDir = join(scriptDir, 'saml-keys');
const certPath = join(keysDir, 'cert.pem');
const keyPath = join(keysDir, 'key.pem');
const envPath = join(keysDir, 'saml.env');

if (existsSync(certPath) && existsSync(keyPath) && existsSync(envPath)) {
  console.log('mock-idp: SAML keys already exist, skipping generation.');
  process.exit(0);
}

mkdirSync(keysDir, { recursive: true });

try {
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -days 3650 -nodes -subj "/CN=jetstream-mock-saml-local-dev-only"`,
    { stdio: 'inherit' },
  );
} catch {
  console.error('mock-idp: openssl not found on PATH. Install openssl (or run in WSL/git-bash on Windows).');
  process.exit(1);
}

const certB64 = readFileSync(certPath).toString('base64');
const keyB64 = readFileSync(keyPath).toString('base64');

writeFileSync(
  envPath,
  [
    `APP_URL=http://localhost:4000`,
    `ENTITY_ID=https://mock-saml.jetstream.local/entityid`,
    `PUBLIC_KEY=${certB64}`,
    `PRIVATE_KEY=${keyB64}`,
    '',
  ].join('\n'),
);

console.log('mock-idp: generated saml-keys/cert.pem, key.pem, saml.env');
