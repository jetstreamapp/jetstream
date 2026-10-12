import {
  ACCESS_PROFILE_OPERATION_KEYS,
  ACCESS_PROFILE_SURFACE_KEYS,
  ACCESS_PROFILE_TOOL_KEYS,
  AccessProfilePolicyRequest,
  TeamAccessProfile,
} from '@jetstream/types';

/** Picklist id standing in for "no profile", which the API represents as null */
export const FULL_ACCESS_ID = 'FULL_ACCESS';
export const FULL_ACCESS_LABEL = 'Full access';

export interface AccessProfilePreset {
  id: string;
  label: string;
  description: string;
  policy: AccessProfilePolicyRequest;
}

const ALL_SURFACES = [...ACCESS_PROFILE_SURFACE_KEYS];

/**
 * Starting points for a new profile. Every preset can still connect orgs, because a member without a connected
 * org cannot use Jetstream at all.
 */
export const ACCESS_PROFILE_PRESETS: AccessProfilePreset[] = [
  {
    id: 'read-only',
    label: 'Read only',
    description: 'Query and export data and run analyses, no changes',
    policy: {
      tools: ['query', 'data-analysis', 'permission-analysis', 'object-export'],
      operations: ['records.export', 'orgs.connect'],
      surfaces: ALL_SURFACES,
    },
  },
  {
    id: 'data-steward',
    label: 'Data steward',
    description: 'Query, load and update records without deleting them',
    policy: {
      tools: ['query', 'load', 'update-records', 'create-record', 'data-history', 'data-analysis'],
      operations: ['records.write', 'records.export', 'orgs.connect'],
      surfaces: ALL_SURFACES,
    },
  },
  {
    id: 'salesforce-admin',
    label: 'Salesforce admin',
    description: 'Configuration tools and deployments, no record changes',
    policy: {
      tools: [
        'query',
        'automation-control',
        'manage-permissions',
        'permission-analysis',
        'data-analysis',
        'deploy-metadata',
        'create-fields',
        'record-type-manager',
        'formula-evaluator',
        'object-export',
      ],
      operations: ['metadata.deploy', 'records.export', 'orgs.connect'],
      surfaces: ALL_SURFACES,
    },
  },
  {
    id: 'everything',
    label: 'Everything',
    description: 'Every current tool and operation, new ones must be added later',
    policy: {
      tools: [...ACCESS_PROFILE_TOOL_KEYS],
      operations: [...ACCESS_PROFILE_OPERATION_KEYS],
      surfaces: ALL_SURFACES,
    },
  },
];

export function getAccessProfileName(accessProfiles: TeamAccessProfile[], accessProfileId: string | null | undefined): string {
  if (!accessProfileId) {
    return FULL_ACCESS_LABEL;
  }
  return accessProfiles.find(({ id }) => id === accessProfileId)?.name ?? 'Unknown profile';
}

export function getDefaultAccessProfileId(accessProfiles: TeamAccessProfile[]): string | null {
  return accessProfiles.find(({ isDefault }) => isDefault)?.id ?? null;
}
