import { ACCESS_PROFILE_FULL_ACCESS_ID, TeamAccessProfile } from '@jetstream/types';

/** Picklist id standing in for "no profile" (null to the API); the same literal a delete sends as `reassignTo` */
export const FULL_ACCESS_ID = ACCESS_PROFILE_FULL_ACCESS_ID;
export const FULL_ACCESS_LABEL = 'Full access';

export function getAccessProfileName(accessProfiles: TeamAccessProfile[], accessProfileId: string | null | undefined): string {
  if (!accessProfileId) {
    return FULL_ACCESS_LABEL;
  }
  return accessProfiles.find(({ id }) => id === accessProfileId)?.name ?? 'Unknown profile';
}

export function getDefaultAccessProfileId(accessProfiles: TeamAccessProfile[]): string | null {
  return accessProfiles.find(({ isDefault }) => isDefault)?.id ?? null;
}
