import type { ScratchOrgCreateRequestInput } from '@jetstream/api-types';
import { SCRATCH_ORG_RELEASES } from '@jetstream/api-types';
import isBoolean from 'lodash/isBoolean';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import type { ParsedScratchOrgDefinition, ScratchOrgObjectSettings, ScratchOrgSettings } from './scratch-org.types';

/** Definition file options that map to a string field on the request */
const STRING_OPTIONS = [
  'orgName',
  'edition',
  'adminEmail',
  'description',
  'country',
  'language',
  'username',
  'namespace',
  'sourceOrg',
  'snapshot',
] as const satisfies readonly (keyof ScratchOrgCreateRequestInput)[];

const HANDLED_OPTIONS = new Set<string>([
  ...STRING_OPTIONS,
  'features',
  'hasSampleData',
  'release',
  'settings',
  'objectSettings',
  '$schema',
]);

/** Features are a list in the definition file, but a `;` or `,` separated string is accepted as well (as the CLI does) */
export function parseFeatures(features: unknown): string[] {
  const values = Array.isArray(features) ? features : isString(features) ? features.split(/[;,\n]/) : [];
  const uniqueFeatures = new Map<string, string>();
  values
    .filter(isString)
    .map((feature) => feature.trim())
    .filter(Boolean)
    .forEach((feature) => {
      // Feature names are not case sensitive, keep the first spelling
      if (!uniqueFeatures.has(feature.toLowerCase())) {
        uniqueFeatures.set(feature.toLowerCase(), feature);
      }
    });
  return Array.from(uniqueFeatures.values());
}

/**
 * Read a scratch org definition file (project-scratch-def.json).
 * https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file.htm
 *
 * @throws if the content is not a JSON object or uses an option Salesforce no longer supports
 */
export function parseScratchOrgDefinition(content: string): ParsedScratchOrgDefinition {
  let definition: unknown;
  try {
    definition = JSON.parse(content);
  } catch {
    throw new Error('The definition is not valid JSON.');
  }
  if (!isPlainObject(definition)) {
    throw new Error('The definition must be a JSON object.');
  }
  const options = definition as Record<string, unknown>;

  if (options.orgPreferences) {
    throw new Error('"orgPreferences" is no longer supported by Salesforce, convert it to "settings".');
  }

  const request: Partial<ScratchOrgCreateRequestInput> = {};
  const warnings: string[] = [];

  STRING_OPTIONS.forEach((option) => {
    const value = options[option];
    if (isString(value) && value.trim()) {
      request[option] = value.trim();
    } else if (value !== undefined && value !== null && value !== '') {
      warnings.push(`"${option}" was ignored because it is not text.`);
    }
  });

  if (options.features !== undefined) {
    request.features = parseFeatures(options.features);
  }

  if (isBoolean(options.hasSampleData)) {
    request.hasSampleData = options.hasSampleData;
  }

  if (isString(options.release)) {
    const release = SCRATCH_ORG_RELEASES.find((item) => item.toLowerCase() === (options.release as string).toLowerCase());
    if (release) {
      request.release = release;
    } else {
      warnings.push(`"release" was ignored because "${options.release}" is not one of ${SCRATCH_ORG_RELEASES.join(', ')}.`);
    }
  }

  Object.keys(options)
    .filter((option) => !HANDLED_OPTIONS.has(option))
    .forEach((option) => warnings.push(`"${option}" is not supported and was ignored.`));

  return {
    request,
    settings: getNonEmptyObject<ScratchOrgSettings>(options.settings, 'settings', warnings),
    objectSettings: getNonEmptyObject<ScratchOrgObjectSettings>(options.objectSettings, 'objectSettings', warnings),
    warnings,
  };
}

function getNonEmptyObject<T extends object>(value: unknown, option: string, warnings: string[]): T | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isPlainObject(value)) {
    warnings.push(`"${option}" was ignored because it is not an object.`);
    return null;
  }
  return Object.keys(value as object).length ? (value as T) : null;
}
