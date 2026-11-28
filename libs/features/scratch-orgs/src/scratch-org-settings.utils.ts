import { deployMetadataZip } from '@jetstream/shared/data';
import { pollMetadataResultsUntilDone } from '@jetstream/shared/ui-utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import JSZip from 'jszip';
import isPlainObject from 'lodash/isPlainObject';
import upperFirst from 'lodash/upperFirst';
import type { ScratchOrgObjectSettings, ScratchOrgSettings } from './scratch-org.types';

const METADATA_NAMESPACE = 'http://soap.sforce.com/2006/04/metadata';

/** Objects whose record types require a business process, and the picklist value that process is seeded with */
const BUSINESS_PROCESS_PICKLIST_VALUES: Record<string, string> = {
  Case: 'New',
  Lead: 'Open - Not Contacted',
  Opportunity: 'Prospecting',
  Solution: 'Draft',
};

function escapeXml(value: unknown): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/** Element names come from user supplied JSON, anything that is not a simple name would produce invalid XML */
function isValidElementName(name: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_.-]*$/.test(name);
}

function toXmlElements(name: string, value: unknown, depth: number): string[] {
  if (value === undefined || value === null || !isValidElementName(name)) {
    return [];
  }
  const indent = '    '.repeat(depth);
  if (Array.isArray(value)) {
    return value.flatMap((item) => toXmlElements(name, item, depth));
  }
  if (isPlainObject(value)) {
    const children = Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => toXmlElements(key, child, depth + 1));
    return [`${indent}<${name}>`, ...children, `${indent}</${name}>`];
  }
  return [`${indent}<${name}>${escapeXml(value)}</${name}>`];
}

function toMetadataXml(rootName: string, value: Record<string, unknown>): string {
  const children = Object.entries(value).flatMap(([key, child]) => toXmlElements(key, child, 1));
  return [`<?xml version="1.0" encoding="UTF-8"?>`, `<${rootName} xmlns="${METADATA_NAMESPACE}">`, ...children, `</${rootName}>`, ''].join(
    '\n',
  );
}

/**
 * Settings that could not be turned into metadata, so that they are reported instead of silently left out.
 * @returns a description of each problem, empty when everything can be deployed
 */
export function getScratchOrgSettingsProblems(
  settings: ScratchOrgSettings | null,
  objectSettings: ScratchOrgObjectSettings | null,
): string[] {
  const problems: string[] = [];
  [
    ['settings', settings ?? {}],
    ['objectSettings', objectSettings ?? {}],
  ].forEach(([section, entries]) => {
    Object.entries(entries as Record<string, unknown>).forEach(([name, value]) => {
      if (!isValidElementName(name)) {
        problems.push(`"${name}" in ${section} is not a valid name`);
      } else if (!isPlainObject(value)) {
        problems.push(`"${name}" in ${section} must be an object`);
      }
    });
  });
  return problems;
}

export function hasScratchOrgSettings(settings: ScratchOrgSettings | null, objectSettings: ScratchOrgObjectSettings | null): boolean {
  return !!Object.keys(settings ?? {}).length || !!Object.keys(objectSettings ?? {}).length;
}

/**
 * Build the metadata package for the `settings` and `objectSettings` of a scratch org definition.
 * Ported from the Salesforce CLI (`scratchOrgSettingsGenerator.ts` in @salesforce/core), which deploys the same
 * files after a scratch org is created.
 *
 * @returns file contents keyed by their path in the package
 */
export function buildScratchOrgSettingsPackage({
  settings,
  objectSettings,
  apiVersion,
}: {
  settings: ScratchOrgSettings | null;
  objectSettings: ScratchOrgObjectSettings | null;
  /** e.g. "62.0" */
  apiVersion: string;
}): Record<string, string> {
  const files: Record<string, string> = {};
  const packageTypes: { name: string; members: string[] }[] = [];

  const settingEntries = Object.entries(settings ?? {}).filter(([name, value]) => isValidElementName(name) && isPlainObject(value));
  if (settingEntries.length) {
    const members = settingEntries.map(([name, value]) => {
      // "lightningExperienceSettings" is the LightningExperienceSettings type in settings/LightningExperience.settings
      const typeName = upperFirst(name);
      const fileName = typeName.replace('Settings', '');
      files[`settings/${fileName}.settings`] = toMetadataXml(typeName, value as Record<string, unknown>);
      return fileName;
    });
    packageTypes.push({ name: 'Settings', members });
  }

  const objectEntries = Object.entries(objectSettings ?? {}).filter(([name, value]) => isValidElementName(name) && isPlainObject(value));
  if (objectEntries.length) {
    const recordTypes: string[] = [];
    const businessProcesses: string[] = [];
    const objectNames = objectEntries.map(([name, { sharingModel, defaultRecordType }]) => {
      const objectName = upperFirst(name);
      const objectMetadata: Record<string, unknown> = {};
      if (sharingModel) {
        objectMetadata.sharingModel = upperFirst(sharingModel);
      }
      if (defaultRecordType) {
        const recordTypeName = upperFirst(defaultRecordType);
        const recordType: Record<string, unknown> = { fullName: recordTypeName, label: recordTypeName, active: true };
        recordTypes.push(`${objectName}.${recordTypeName}`);

        const picklistValue = BUSINESS_PROCESS_PICKLIST_VALUES[objectName];
        if (picklistValue) {
          const businessProcessName = `${recordTypeName}Process`;
          recordType.businessProcess = businessProcessName;
          businessProcesses.push(`${objectName}.${businessProcessName}`);
          objectMetadata.businessProcesses = {
            fullName: businessProcessName,
            isActive: true,
            // Opportunity stages cannot be flagged as the default on a business process
            values: objectName === 'Opportunity' ? { fullName: picklistValue } : { fullName: picklistValue, default: true },
          };
        }
        objectMetadata.recordTypes = recordType;
      }
      files[`objects/${objectName}.object`] = toMetadataXml('CustomObject', objectMetadata);
      return objectName;
    });

    packageTypes.push({ name: 'CustomObject', members: objectNames });
    if (recordTypes.length) {
      packageTypes.push({ name: 'RecordType', members: recordTypes });
    }
    if (businessProcesses.length) {
      packageTypes.push({ name: 'BusinessProcess', members: businessProcesses });
    }
  }

  if (packageTypes.length) {
    files['package.xml'] = toMetadataXml('Package', {
      types: packageTypes.map(({ name, members }) => ({ members, name })),
      version: apiVersion,
    });
  }

  return files;
}

/**
 * Deploy the settings of a scratch org definition to a connected scratch org.
 * @throws with the component failures if Salesforce rejects any of the settings
 */
export async function deployScratchOrgSettings(
  scratchOrg: SalesforceOrgUi,
  options: Parameters<typeof buildScratchOrgSettingsPackage>[0],
): Promise<void> {
  const files = buildScratchOrgSettingsPackage(options);
  if (!Object.keys(files).length) {
    return;
  }

  const zip = new JSZip();
  Object.entries(files).forEach(([path, content]) => zip.file(path, content));
  const zipFile = await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' });

  const { id } = await deployMetadataZip(scratchOrg, zipFile, { singlePackage: true, rollbackOnError: true });
  const results = await pollMetadataResultsUntilDone(scratchOrg, id, { includeDetails: true, interval: 3000 });

  if (!results.success) {
    const failures = [results.details?.componentFailures ?? []]
      .flat()
      .map(({ fullName, problem }) => `${fullName}: ${problem}`)
      .join(' ');
    throw new Error(failures || results.errorMessage || 'Salesforce rejected the settings.');
  }
}
