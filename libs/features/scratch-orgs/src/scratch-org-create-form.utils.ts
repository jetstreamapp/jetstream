import {
  SCRATCH_ORG_DEFAULT_DURATION_DAYS,
  SCRATCH_ORG_RELEASES,
  ScratchOrgCreateRequestInput,
  ScratchOrgCreateRequestSchema,
} from '@jetstream/api-types';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import isPlainObject from 'lodash/isPlainObject';
import isString from 'lodash/isString';
import { z } from 'zod';
import { getScratchOrgFeatureProblems, normalizeScratchOrgFeatures } from './scratch-org-features';
import { getScratchOrgSettingsProblems, hasScratchOrgSettings } from './scratch-org-settings.utils';
import type { ParsedScratchOrgDefinition, ScratchOrgObjectSettings, ScratchOrgSettings } from './scratch-org.types';

/** Value of the release picklist that leaves the choice to Salesforce (the Dev Hub's own release) */
export const DEFAULT_RELEASE = '';

export interface CreateScratchOrgFormState {
  orgName: string;
  edition: string;
  durationDays: number;
  adminEmail: string;
  description: string;
  /** As written in a definition file, e.g. `Communities` or `MaxApexCodeSize:10` */
  features: string[];
  hasSampleData: boolean;
  release: string;
  country: string;
  language: string;
  username: string;
  namespace: string;
  sourceOrg: string;
  snapshot: string;
  /** JSON object with the optional `settings` and `objectSettings` of a definition file */
  settingsJson: string;
}

export type CreateScratchOrgFormErrors = Partial<Record<keyof CreateScratchOrgFormState, string>>;

export interface CreateScratchOrgFormValidation {
  /** null while the form has a problem */
  request: ScratchOrgCreateRequestInput | null;
  errors: CreateScratchOrgFormErrors;
  /** Deployed to the scratch org after it is created, they are not part of the request */
  settings: ScratchOrgSettings | null;
  objectSettings: ScratchOrgObjectSettings | null;
}

export function getInitialCreateScratchOrgForm(devHubOrg: SalesforceOrgUi): CreateScratchOrgFormState {
  return {
    orgName: '',
    edition: 'Developer',
    durationDays: SCRATCH_ORG_DEFAULT_DURATION_DAYS,
    adminEmail: devHubOrg.email || '',
    description: '',
    features: [],
    hasSampleData: false,
    release: DEFAULT_RELEASE,
    country: '',
    language: '',
    username: '',
    namespace: '',
    sourceOrg: '',
    snapshot: '',
    settingsJson: '',
  };
}

/** An org shape or snapshot determines the edition, so the edition of the form does not apply */
export function isFromShapeOrSnapshot({ sourceOrg, snapshot }: Pick<CreateScratchOrgFormState, 'sourceOrg' | 'snapshot'>): boolean {
  return !!sourceOrg.trim() || !!snapshot.trim();
}

export function parseSettingsJson(settingsJson: string): {
  settings: ScratchOrgSettings | null;
  objectSettings: ScratchOrgObjectSettings | null;
  error: string | null;
} {
  if (!settingsJson.trim()) {
    return { settings: null, objectSettings: null, error: null };
  }
  try {
    const value: unknown = JSON.parse(settingsJson);
    if (!isPlainObject(value)) {
      throw new Error('Settings must be a JSON object');
    }
    const { settings, objectSettings, ...unknownKeys } = value as Record<string, unknown>;
    if (Object.keys(unknownKeys).length) {
      throw new Error(`Only "settings" and "objectSettings" are allowed here, found "${Object.keys(unknownKeys).join('", "')}"`);
    }
    if ((settings && !isPlainObject(settings)) || (objectSettings && !isPlainObject(objectSettings))) {
      throw new Error('"settings" and "objectSettings" must be JSON objects');
    }
    const parsedSettings = (settings as ScratchOrgSettings) ?? null;
    const parsedObjectSettings = (objectSettings as ScratchOrgObjectSettings) ?? null;
    const [problem] = getScratchOrgSettingsProblems(parsedSettings, parsedObjectSettings);
    if (problem) {
      throw new Error(problem);
    }
    return { settings: parsedSettings, objectSettings: parsedObjectSettings, error: null };
  } catch (ex) {
    return { settings: null, objectSettings: null, error: ex instanceof SyntaxError ? 'Settings are not valid JSON' : getErrorMessage(ex) };
  }
}

export function toCreateScratchOrgRequest(form: CreateScratchOrgFormState): ScratchOrgCreateRequestInput {
  return {
    orgName: form.orgName,
    edition: isFromShapeOrSnapshot(form) ? undefined : form.edition,
    durationDays: form.durationDays,
    adminEmail: form.adminEmail.trim() || undefined,
    description: form.description,
    features: normalizeScratchOrgFeatures(form.features),
    hasSampleData: form.hasSampleData || undefined,
    release: SCRATCH_ORG_RELEASES.find((release) => release === form.release),
    country: form.country,
    language: form.language,
    username: form.username.trim() || undefined,
    namespace: form.namespace,
    sourceOrg: form.sourceOrg.trim() || undefined,
    snapshot: form.snapshot,
  };
}

/** The request to send, or what is wrong with the form. At most one problem is reported per field. */
export function validateCreateScratchOrgForm(form: CreateScratchOrgFormState): CreateScratchOrgFormValidation {
  const request = toCreateScratchOrgRequest(form);
  const result = ScratchOrgCreateRequestSchema.safeParse(request);
  const errors: CreateScratchOrgFormErrors = {};
  if (!result.success) {
    Object.entries(z.flattenError(result.error).fieldErrors).forEach(([field, messages]) => {
      errors[field as keyof CreateScratchOrgFormState] = (messages as string[] | undefined)?.[0];
    });
  }
  const { settings, objectSettings, error: settingsError } = parseSettingsJson(form.settingsJson);
  if (settingsError) {
    errors.settingsJson = settingsError;
  }
  const [featureProblem] = getScratchOrgFeatureProblems(form.features);
  if (featureProblem) {
    errors.features = featureProblem;
  }
  return { request: Object.keys(errors).length ? null : request, errors, settings, objectSettings };
}

/** Fill the form from a definition file. Only the options the file has are replaced, the rest of the form is kept. */
export function applyDefinitionToCreateScratchOrgForm(
  priorForm: CreateScratchOrgFormState,
  { request: definition, settings, objectSettings }: Pick<ParsedScratchOrgDefinition, 'request' | 'settings' | 'objectSettings'>,
): CreateScratchOrgFormState {
  return {
    ...priorForm,
    orgName: definition.orgName ?? priorForm.orgName,
    edition: definition.edition ?? priorForm.edition,
    adminEmail: isString(definition.adminEmail) ? definition.adminEmail : priorForm.adminEmail,
    description: definition.description ?? priorForm.description,
    features: definition.features ?? priorForm.features,
    hasSampleData: definition.hasSampleData ?? priorForm.hasSampleData,
    release: definition.release ?? priorForm.release,
    country: definition.country ?? priorForm.country,
    language: definition.language ?? priorForm.language,
    username: isString(definition.username) ? definition.username : priorForm.username,
    namespace: definition.namespace ?? priorForm.namespace,
    sourceOrg: definition.sourceOrg ?? priorForm.sourceOrg,
    snapshot: definition.snapshot ?? priorForm.snapshot,
    settingsJson: hasScratchOrgSettings(settings, objectSettings)
      ? JSON.stringify({ ...(settings ? { settings } : {}), ...(objectSettings ? { objectSettings } : {}) }, null, 2)
      : priorForm.settingsJson,
  };
}
