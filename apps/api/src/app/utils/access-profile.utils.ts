import { ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES, isAccessProfileOperationAllowed } from '@jetstream/types';
import { findActiveTeamAccessProfile } from '../db/user.db';
import { NotAllowedError } from './error-handler';

/**
 * Refuses sync requests from a member whose team access profile excludes history sync. Checked against the database
 * on every request so a profile edit takes effect immediately, which is what lets an admin promise that data from a
 * restricted member never lands on the server, regardless of what the member's client does.
 */
export async function assertHistorySyncAllowed(userId: string) {
  if (!isAccessProfileOperationAllowed(await findActiveTeamAccessProfile({ userId }), 'history.sync')) {
    throw new NotAllowedError(ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES['history.sync']);
  }
}

/**
 * Refuses connecting a Salesforce org that is new to the member when their team access profile excludes
 * `orgs.connect`. Re-authorizing an org they already have (an expired token or a refreshed sandbox) is always allowed,
 * otherwise an org that needs a new login would lock the member out of Jetstream.
 */
export async function assertOrgConnectAllowed(userId: string, { isExistingOrg }: { isExistingOrg: boolean }) {
  if (isExistingOrg) {
    return;
  }
  if (!isAccessProfileOperationAllowed(await findActiveTeamAccessProfile({ userId }), 'orgs.connect')) {
    throw new NotAllowedError(ACCESS_PROFILE_OPERATION_NOT_ALLOWED_MESSAGES['orgs.connect']);
  }
}
