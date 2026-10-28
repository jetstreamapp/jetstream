import { deployMetadata, queryAll } from '@jetstream/shared/data';
import { escapeHtml, pollMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import { CustomPermissionRecord, DeployResult, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import { generatePermissionSetApiName, isValidPermissionSetApiName } from './permission-set-create-utils';

/** Salesforce caps both the label and the API name of a custom permission at 80 characters */
export const CUSTOM_PERMISSION_NAME_MAX_LENGTH = 80;
export const CUSTOM_PERMISSION_DESCRIPTION_MAX_LENGTH = 255;

export interface CustomPermissionCreateInput {
  label: string;
  /** API name without namespace prefix */
  name: string;
  description: string;
}

/** Custom permission API names follow the same rules as permission set API names */
export const generateCustomPermissionApiName = generatePermissionSetApiName;
export const isValidCustomPermissionApiName = isValidPermissionSetApiName;

export function getCustomPermissionMetadataXml({ label, description }: CustomPermissionCreateInput): string {
  const descriptionXml = description ? `\n    <description>${escapeHtml(description)}</description>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>
<CustomPermission xmlns="http://soap.sforce.com/2006/04/metadata">${descriptionXml}
    <isLicensed>false</isLicensed>
    <label>${escapeHtml(label)}</label>
</CustomPermission>
`;
}

export function getCustomPermissionPackageXml(name: string, apiVersion: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
    <types>
        <members>${escapeHtml(name)}</members>
        <name>CustomPermission</name>
    </types>
    <version>${apiVersion.replace('v', '')}</version>
</Package>
`;
}

/** Everything Salesforce reported about a failed deployment, joined into one message */
export function getDeployFailureMessage(results: DeployResult): string {
  const componentFailures = Array.isArray(results.details?.componentFailures)
    ? results.details.componentFailures
    : results.details?.componentFailures
      ? [results.details.componentFailures]
      : [];
  const messages = componentFailures.map(({ problem }) => problem).filter(Boolean);
  if (messages.length) {
    return messages.join('\n');
  }
  return results.errorMessage || 'The custom permission could not be created.';
}

/**
 * Custom permissions cannot be created through the sObject or Tooling APIs, so this deploys a one-file metadata package
 * and waits for the deployment to finish. Resolves with the created record so it can be added to the table without
 * reloading everything.
 */
export async function createCustomPermission(
  org: SalesforceOrgUi,
  apiVersion: string,
  input: CustomPermissionCreateInput,
  onProgress?: (message: string) => void,
): Promise<CustomPermissionRecord> {
  onProgress?.('Deploying custom permission');
  const { id } = await deployMetadata(
    org,
    [
      { fullFilename: `customPermissions/${input.name}.customPermission`, content: getCustomPermissionMetadataXml(input) },
      { fullFilename: 'package.xml', content: getCustomPermissionPackageXml(input.name, apiVersion) },
    ],
    { singlePackage: true, rollbackOnError: true },
  );
  const results = await pollMetadataResultsUntilDone(org, id, { includeDetails: true, interval: 1000 });
  if (!results.success) {
    throw new Error(getDeployFailureMessage(results));
  }

  onProgress?.('Loading the new custom permission');
  const record = await fetchCustomPermissionByName(org, input.name);
  if (!record) {
    throw new Error(`The custom permission was created, but could not be loaded. Use Reload All Permissions to see it.`);
  }
  return record;
}

/** The namespace is left off the filter: an org with a namespace creates the permission inside it, one without does not */
export async function fetchCustomPermissionByName(org: SalesforceOrgUi, developerName: string): Promise<CustomPermissionRecord | null> {
  const { queryResults } = await queryAll<CustomPermissionRecord>(
    org,
    composeQuery({
      fields: ['Id', 'DeveloperName', 'MasterLabel', 'NamespacePrefix', 'Description', 'IsLicensed', 'IsProtected'].map((field) =>
        getField(field),
      ),
      sObject: 'CustomPermission',
      where: { left: { field: 'DeveloperName', operator: '=', value: developerName, literalType: 'STRING' } },
    }),
  );
  return queryResults.records[0] || null;
}
