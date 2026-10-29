import { logger } from '@jetstream/shared/client-logger';
import { AccessProfilePolicySchema, SalesforceOrgUi, type AccessProfilePolicy } from '@jetstream/types';
import isPlainObject from 'lodash/isPlainObject';

export type CanvasAccessPolicy = Pick<AccessProfilePolicy, 'tools' | 'operations'>;

function parseIfJsonString(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Reads the `accessProfile` canvas parameter the packaged JetstreamPage Visualforce page sends, built from the
 * user's Jetstream custom permissions in Salesforce. Returns `null` for full access.
 *
 * - Missing: an older package version, or the app was opened from somewhere other than JetstreamPage
 * - `null`: the user does not have the Limited Access custom permission
 * - Otherwise: the user has Limited Access and only gets the tools and operations listed
 *
 * Connecting orgs is always allowed because the canvas app only works with the org that opened it.
 */
export function parseCanvasAccessPolicy(accessProfile: unknown): CanvasAccessPolicy | null {
  // Salesforce may hand a nested parameter over as JSON text rather than an object, so a user without
  // Limited Access can arrive as the string "null" and must still get full access
  const value = parseIfJsonString(accessProfile);
  if (value === undefined || value === null) {
    return null;
  }
  // Limited Access is on, so a value that cannot be read shows no tools rather than every tool (fail closed)
  if (!isPlainObject(value)) {
    logger.warn('[CANVAS] Could not read the accessProfile parameter, hiding all tools', accessProfile);
    return { tools: [], operations: ['orgs.connect'] };
  }
  const { tools, operations } = AccessProfilePolicySchema.parse(value);
  return { tools, operations: Array.from(new Set([...operations, 'orgs.connect' as const])) };
}

export function getCanvasOrg(): SalesforceOrgUi {
  const { client, context } = window.sr;
  const { organization, user } = context;
  return {
    id: 1,
    uniqueId: `${organization.organizationId}-${user.userId}`,
    label: user.userName,
    filterText: '',
    accessToken: client.oauthToken,
    instanceUrl: client.instanceUrl,
    loginUrl: client.instanceUrl,
    userId: user.userId,
    email: user.email,
    organizationId: organization.organizationId,
    username: user.userName,
    displayName: user.fullName,
  };
}

/**
 * Extract the sandbox name from a Salesforce My Domain host/URL, e.g.
 * `https://acme--uat.sandbox.my.salesforce.com` -> `uat`. Returns null for production or
 * hosts that don't match the sandbox My Domain pattern.
 */
export function extractSandboxName(hostOrUrl: string | undefined | null): string | null {
  if (!hostOrUrl) {
    return null;
  }
  const match = /--([^.]+)\.sandbox\./i.exec(hostOrUrl);
  return match ? match[1] : null;
}

/**
 * Derive the local-storage scope id for canvas. Canvas has no Jetstream login, and keying storage by
 * the exact org means a user's query history / saved mappings do not follow them from a production org
 * to its sandboxes (each has a distinct org + user id). Salesforce usernames are globally unique and a
 * sandbox username is exactly `<productionUsername>.<sandboxName>`, so stripping the sandbox suffix
 * (derived from the My Domain host) recovers the production username — stable across a prod org and all
 * its sandboxes for that user. Falls back to the full username when the org is not a detectable sandbox.
 * Two different users never share a scope because usernames are globally unique (unlike email, which some
 * orgs bulk-rewrite on sandbox refresh).
 */
export function deriveCanvasScopeId({ username, hostOrUrl }: { username: string; hostOrUrl?: string | null }): string {
  const sandboxName = extractSandboxName(hostOrUrl);
  if (sandboxName) {
    const suffix = `.${sandboxName}`.toLowerCase();
    if (username.toLowerCase().endsWith(suffix)) {
      return username.slice(0, username.length - suffix.length);
    }
  }
  return username;
}

export function getCanvasStorageScopeId(): string {
  const { client, context } = window.sr;
  return deriveCanvasScopeId({
    username: context.user.userName,
    hostOrUrl: client.instanceUrl || context.environment.locationUrl,
  });
}
