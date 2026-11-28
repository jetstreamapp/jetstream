import { ListMetadataResult } from '@jetstream/types';

export interface MetadataComparabilityInfo {
  comparable: boolean;
  reason?: string;
}

/**
 * Metadata types that cannot be compared meaningfully across orgs because they contain
 * environment-specific endpoints, masked secrets, installed package metadata, or org-only settings.
 * We mark these explicitly instead of guessing or emitting misleading diffs.
 */
const UNCOMPARABLE_METADATA_TYPES: Record<string, string> = {
  AuthProvider: 'Contains environment-specific OAuth callback URLs and masked client secrets.',
  Certificate: 'Certificates and private keys are org-specific and cannot be compared or deployed directly.',
  ConnectedApp: 'Contains org-specific OAuth consumer keys, callback URLs, and masked secrets.',
  ExternalCredential: 'Contains masked authentication secrets and environment-specific credentials.',
  ExternalDataSource: 'Contains environment-specific endpoints and masked credentials.',
  InstalledPackage: 'Managed packages are installed by version rather than compared or deployed as source XML.',
  NamedCredential: 'Contains environment-specific endpoints and masked credentials that Salesforce omits on retrieve.',
  SamlSsoConfig: 'Contains org-specific identity provider endpoints and signing certificates.',
  Settings: 'Org settings vary by environment and enabled Salesforce features and cannot be compared reliably as a whole.',
};

/**
 * Classify whether a Salesforce metadata type can be meaningfully compared across two orgs.
 * Any `*Settings` metadata type (e.g. SecuritySettings, AccountSettings) is also treated as
 * org-specific settings so we never guess on environment-dependent configuration.
 */
export function getMetadataTypeComparability(metadataType: string): MetadataComparabilityInfo {
  const exactReason = UNCOMPARABLE_METADATA_TYPES[metadataType];
  if (exactReason) {
    return { comparable: false, reason: exactReason };
  }
  if (metadataType.endsWith('Settings') && metadataType !== 'RemoteSiteSetting') {
    return {
      comparable: false,
      reason: 'Org settings depend on environment-specific configuration and enabled features.',
    };
  }
  return { comparable: true };
}

/**
 * Salesforce returns `manageableState: 'unmanaged'` (or undefined/null for unmanaged standard metadata)
 * for customer-owned components, and values like `installed`, `installedEditable`, `released`,
 * `deprecated`, `deprecatedEditable`, or `beta` for managed package components.
 */
export function isManagedListMetadataItem(item: Pick<ListMetadataResult, 'manageableState'>): boolean {
  return Boolean(item.manageableState && item.manageableState !== 'unmanaged');
}

export const MANAGED_COMPONENT_UNCOMPARABLE_REASON =
  'Managed package components have hidden or package-controlled source in Salesforce and cannot be compared or deployed directly.';

export const PROFILE_METADATA_TYPE = 'Profile';

/**
 * Salesforce only returns the parts of a profile (object, field, class, page, tab, layout, record type and app
 * access) that relate to other components named in the same retrieve request. Profiles are retrieved together
 * with every component of these types so that the whole profile is compared.
 */
export const PROFILE_COMPANION_METADATA_TYPES = new Set([
  'ApexClass',
  'ApexPage',
  'CustomApplication',
  'CustomField',
  'CustomObject',
  'CustomPermission',
  'CustomTab',
  'ExternalDataSource',
  'Flow',
  'Layout',
  'RecordType',
]);

/** Companions that are returned inside their object's file and so do not add to the retrieved file count */
const PROFILE_COMPANION_TYPES_WITHOUT_FILES = new Set(['CustomField', 'RecordType']);

/** Above this the retrieve would exceed Salesforce's 10,000 file limit (Apex is two files per component) */
export const MAX_PROFILE_COMPANIONS_WITH_FILES = 4000;

/** Profiles are large and each chunk also retrieves every companion, so they are retrieved a few at a time */
export const PROFILE_RETRIEVE_CHUNK_SIZE = 50;

export const PROFILE_TOO_LARGE_UNCOMPARABLE_REASON =
  'Profiles are only complete when retrieved together with the objects, classes, pages, tabs and layouts they refer to, and these orgs have too many of them to retrieve in one request.';

/**
 * Every component a profile can refer to, from the listings of the metadata types already compared.
 * Returns null when there are too many to retrieve alongside the profiles in one request.
 */
export function getProfileCompanions(listItemsByType: Record<string, ListMetadataResult[]>): Record<string, ListMetadataResult[]> | null {
  const companions: Record<string, ListMetadataResult[]> = {};
  let companionsWithFiles = 0;
  for (const [metadataType, items] of Object.entries(listItemsByType)) {
    if (!PROFILE_COMPANION_METADATA_TYPES.has(metadataType) || items.length === 0) {
      continue;
    }
    companions[metadataType] = items;
    if (!PROFILE_COMPANION_TYPES_WITHOUT_FILES.has(metadataType)) {
      companionsWithFiles += items.length;
    }
  }
  return companionsWithFiles > MAX_PROFILE_COMPANIONS_WITH_FILES ? null : companions;
}
