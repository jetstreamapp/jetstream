/**
 * Tooling CustomField uses DeveloperName (no trailing __c) and optional NamespacePrefix.
 *
 * @see https://developer.salesforce.com/docs/atlas.en-us.api_tooling.meta/api_tooling/tooling_api_objects_customfield.htm
 */
export interface CustomFieldToolingNameParts {
  namespacePrefix: string | null;
  developerName: string;
}

/**
 * Maps a custom field API name to Tooling CustomField query filters.
 * Unmanaged: Amount__c → DeveloperName Amount, NamespacePrefix null.
 * Managed: acme__Amount__c → DeveloperName Amount, NamespacePrefix acme.
 */
export function parseCustomFieldApiNameForTooling(fieldApiName: string): CustomFieldToolingNameParts | null {
  const trimmed = fieldApiName.trim();
  if (!trimmed.endsWith('__c')) {
    return null;
  }
  const withoutSuffix = trimmed.slice(0, -3);
  const separatorIndex = withoutSuffix.indexOf('__');
  if (separatorIndex === -1) {
    return { namespacePrefix: null, developerName: withoutSuffix };
  }
  const namespacePrefix = withoutSuffix.slice(0, separatorIndex);
  const developerName = withoutSuffix.slice(separatorIndex + 2);
  if (!developerName) {
    return null;
  }
  return {
    namespacePrefix: namespacePrefix.length > 0 ? namespacePrefix : null,
    developerName,
  };
}
