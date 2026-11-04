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
