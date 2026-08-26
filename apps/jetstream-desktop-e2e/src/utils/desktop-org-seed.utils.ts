import { OrgsPersistence, OrgsPersistenceSchema, SalesforceOrgSchema, SalesforceOrgServer } from '@jetstream/desktop/types';
import { salesforceLoginJwtBearer } from '@jetstream/salesforce-oauth';
import { Buffer } from 'node:buffer';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Magic bytes identifying the portable AES-256-GCM encryption format — must match `persistence.service.ts`. */
const JSEK_MAGIC = Buffer.from('JSEK');
const PORTABLE_TOKEN_PREFIX = 'jsek:';

/**
 * Mirrors `persistence.service.ts`'s `encryptOrgsData` (the whole-file wrapper): AES-256-GCM,
 * format `[4-byte 'JSEK' magic][12-byte IV][16-byte authTag][ciphertext]`.
 */
function encryptOrgsData(data: string, key: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([JSEK_MAGIC, iv, authTag, encrypted]);
}

/**
 * Mirrors `persistence.service.ts`'s `encryptTokenPortable` (the per-org token field): AES-256-GCM,
 * `"jsek:" + base64(iv(12) + authTag(16) + ciphertext)`. Same key as the whole-file wrapper above,
 * different (smaller) container — no magic bytes, base64 instead of raw binary.
 */
function encryptTokenPortable(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return PORTABLE_TOKEN_PREFIX + Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/** Mirrors `persistence.service.ts`'s `getOrgsFilePathForUser` — must match exactly or the app can't find the file. */
function getOrgsFileName(jetstreamUserId: string): string {
  const scopeHash = createHash('sha256').update(jetstreamUserId).digest('hex').slice(0, 32);
  return `orgs-${scopeHash}.json`;
}

interface SalesforceIdentity {
  user_id: string;
  organization_id: string;
  username: string;
  display_name: string;
  email: string;
  photos?: { thumbnail?: string };
}

/**
 * Logs into the shared CI Salesforce sandbox org via the JWT Bearer flow (no interactive OAuth,
 * no browser) — the same mechanism `apps/api/src/app/routes/test.routes.ts`'s `/e2e-integration-org`
 * route already uses to provision the org for the web app's E2E suite. Requires the same CI env vars:
 * `SFDC_CI_CONSUMER_KEY`, `SFDC_CI_PRIVATE_KEY_BASE64`, `E2E_LOGIN_URL`, `E2E_LOGIN_USERNAME`.
 */
async function loginToSalesforceViaJwtBearer(): Promise<{
  accessToken: string;
  instanceUrl: string;
  identity: SalesforceIdentity;
}> {
  const clientId = process.env.SFDC_CI_CONSUMER_KEY;
  const privateKeyBase64 = process.env.SFDC_CI_PRIVATE_KEY_BASE64;
  const loginUrl = process.env.E2E_LOGIN_URL;
  const username = process.env.E2E_LOGIN_USERNAME;
  if (!clientId || !privateKeyBase64 || !loginUrl || !username) {
    throw new Error(
      'Missing SFDC_CI_CONSUMER_KEY / SFDC_CI_PRIVATE_KEY_BASE64 / E2E_LOGIN_URL / E2E_LOGIN_USERNAME — required to seed a Salesforce org for this test',
    );
  }
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

  const { access_token, instance_url, id } = await salesforceLoginJwtBearer({ clientId, privateKey, loginUrl, username });

  // The JWT Bearer response's `id` field is the org's identity URL, e.g.
  // "https://<host>/id/<organizationId>/<userId>" — the identity endpoint is just an authenticated
  // GET against that same URL.
  const identityResponse = await fetch(id, {
    headers: { Authorization: `Bearer ${access_token}`, Accept: 'application/json' },
  });
  if (!identityResponse.ok) {
    throw new Error(`Failed to fetch Salesforce identity: ${identityResponse.status} ${await identityResponse.text()}`);
  }
  const identity = (await identityResponse.json()) as SalesforceIdentity;

  return { accessToken: access_token, instanceUrl: instance_url, identity };
}

/**
 * Seeds one real Salesforce org into an isolated `--user-data-dir`'s `orgs-<hash>.json`, in the
 * exact double-encrypted format `persistence.service.ts` reads: the per-org `accessToken` field is
 * itself `encryptTokenPortable`-encoded, then the whole `{ jetstreamOrganizations, salesforceOrgs }`
 * JSON blob is wrapped again with `encryptOrgsData`. This copies a small, already-tested format
 * rather than reusing bundled app code (which isn't reachable from outside the built main.js — see
 * `electron-launch.utils.ts`) — if the real format ever drifts, the app's own decrypt path fails
 * loudly on the next test run instead of silently diverging.
 *
 * The seeded token has no usable refresh token (the JWT Bearer flow doesn't return one), so a token
 * refresh mid-test will fail — acceptable for a short smoke test, not for anything longer-running.
 */
export async function seedSalesforceOrg(userDataDir: string, jetstreamUserId: string, encryptionKeyHex: string): Promise<void> {
  const { accessToken, instanceUrl, identity } = await loginToSalesforceViaJwtBearer();
  const key = Buffer.from(encryptionKeyHex, 'hex');

  // Trailing space, empty refresh token — `route.utils.ts`'s `initApiConnection` splits on the
  // first space (`accessToken = plaintext.slice(0, spaceIndex)`, `refreshToken = plaintext.slice(spaceIndex + 1)`).
  const encryptedAccessToken = encryptTokenPortable(`${accessToken} `, key);

  const org: SalesforceOrgServer = SalesforceOrgSchema.parse({
    uniqueId: `${identity.organization_id}-${identity.user_id}`,
    filterText: `${identity.username} ${identity.display_name} ${identity.organization_id}`,
    accessToken: encryptedAccessToken,
    instanceUrl,
    loginUrl: instanceUrl,
    userId: identity.user_id,
    email: identity.email,
    organizationId: identity.organization_id,
    username: identity.username,
    displayName: identity.display_name,
    thumbnail: identity.photos?.thumbnail,
    label: identity.username,
  });

  const orgsPersistence: OrgsPersistence = OrgsPersistenceSchema.parse({
    jetstreamOrganizations: [],
    salesforceOrgs: [org],
  });

  const encryptedBlob = encryptOrgsData(JSON.stringify(orgsPersistence), key);
  await fs.writeFile(path.join(userDataDir, getOrgsFileName(jetstreamUserId)), new Uint8Array(encryptedBlob));
}
