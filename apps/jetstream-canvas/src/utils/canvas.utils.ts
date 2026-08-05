import { SalesforceOrgUi } from '@jetstream/types';

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
