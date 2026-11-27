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
