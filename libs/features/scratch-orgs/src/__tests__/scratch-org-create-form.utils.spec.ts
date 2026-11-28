import type { SalesforceOrgUi } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  applyDefinitionToCreateScratchOrgForm,
  getInitialCreateScratchOrgForm,
  parseSettingsJson,
  toCreateScratchOrgRequest,
  validateCreateScratchOrgForm,
} from '../scratch-org-create-form.utils';

const DEV_HUB = { email: 'admin@example.com' } as SalesforceOrgUi;
const INITIAL_FORM = getInitialCreateScratchOrgForm(DEV_HUB);

describe('getInitialCreateScratchOrgForm', () => {
  it('starts as a valid request for a Developer edition org with the email of the Dev Hub user', () => {
    expect(INITIAL_FORM).toMatchObject({ edition: 'Developer', adminEmail: 'admin@example.com', features: [], release: '' });
    expect(validateCreateScratchOrgForm(INITIAL_FORM)).toMatchObject({ errors: {}, settings: null, objectSettings: null });
    expect(validateCreateScratchOrgForm(INITIAL_FORM).request).not.toBeNull();
  });
});

describe('toCreateScratchOrgRequest', () => {
  it('leaves out blank optional values and a release that is left to the Dev Hub', () => {
    expect(toCreateScratchOrgRequest({ ...INITIAL_FORM, adminEmail: ' ', username: '' })).toMatchObject({
      edition: 'Developer',
      adminEmail: undefined,
      username: undefined,
      release: undefined,
      hasSampleData: undefined,
      sourceOrg: undefined,
    });
  });

  it('drops the edition when the scratch org comes from an org shape or a snapshot', () => {
    expect(toCreateScratchOrgRequest({ ...INITIAL_FORM, sourceOrg: '00D000000000001' }).edition).toBeUndefined();
    expect(toCreateScratchOrgRequest({ ...INITIAL_FORM, snapshot: 'my-snapshot' }).edition).toBeUndefined();
  });

  it('sends features as they are written in a definition file', () => {
    expect(
      toCreateScratchOrgRequest({ ...INITIAL_FORM, features: ['Communities', 'BenefitManagement:', 'AddCustomApps:5'] }).features,
    ).toEqual(['Communities', 'BenefitManagement', 'AddCustomApps:5']);
  });
});

describe('parseSettingsJson', () => {
  it('accepts blank, settings and objectSettings', () => {
    expect(parseSettingsJson('  ')).toEqual({ settings: null, objectSettings: null, error: null });
    expect(
      parseSettingsJson(JSON.stringify({ settings: { mobileSettings: {} }, objectSettings: { case: { sharingModel: 'private' } } })),
    ).toEqual({ settings: { mobileSettings: {} }, objectSettings: { case: { sharingModel: 'private' } }, error: null });
  });

  it('explains what is wrong', () => {
    expect(parseSettingsJson('{').error).toBe('Settings are not valid JSON');
    expect(parseSettingsJson('[]').error).toBe('Settings must be a JSON object');
    expect(parseSettingsJson('{"features": []}').error).toBe('Only "settings" and "objectSettings" are allowed here, found "features"');
    expect(parseSettingsJson('{"settings": []}').error).toBe('"settings" and "objectSettings" must be JSON objects');
  });
});

describe('validateCreateScratchOrgForm', () => {
  it('has no request while a field, the settings or a feature has a problem', () => {
    const validation = validateCreateScratchOrgForm({
      ...INITIAL_FORM,
      adminEmail: 'not-an-email',
      settingsJson: '{',
      features: ['AddCustomApps'],
    });

    expect(validation.request).toBeNull();
    expect(validation.errors).toMatchObject({ settingsJson: 'Settings are not valid JSON', features: 'AddCustomApps requires a value' });
    expect(validation.errors.adminEmail).toBeTruthy();
  });
});

describe('applyDefinitionToCreateScratchOrgForm', () => {
  it('replaces only what the definition has', () => {
    const form = applyDefinitionToCreateScratchOrgForm(
      { ...INITIAL_FORM, description: 'Typed in', country: 'NL' },
      { request: { orgName: 'Demo', features: ['Communities'], hasSampleData: true }, settings: null, objectSettings: null },
    );

    expect(form).toMatchObject({
      orgName: 'Demo',
      features: ['Communities'],
      hasSampleData: true,
      description: 'Typed in',
      country: 'NL',
      adminEmail: 'admin@example.com',
      settingsJson: '',
    });
  });

  it('writes the settings of the definition as the JSON of the settings field', () => {
    const { settingsJson } = applyDefinitionToCreateScratchOrgForm(INITIAL_FORM, {
      request: {},
      settings: { mobileSettings: { enableS1EncryptedStoragePref2: false } },
      objectSettings: null,
    });

    expect(JSON.parse(settingsJson)).toEqual({ settings: { mobileSettings: { enableS1EncryptedStoragePref2: false } } });
  });
});
