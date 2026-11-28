import { describe, expect, it } from 'vitest';
import { parseFeatures, parseScratchOrgDefinition } from '../scratch-org-definition.utils';

describe('parseFeatures', () => {
  it('accepts a list or a separated string', () => {
    expect(parseFeatures(['Communities', ' ServiceCloud '])).toEqual(['Communities', 'ServiceCloud']);
    expect(parseFeatures('Communities; ServiceCloud,MultiCurrency\nPersonAccounts')).toEqual([
      'Communities',
      'ServiceCloud',
      'MultiCurrency',
      'PersonAccounts',
    ]);
  });

  it('removes blanks, duplicates regardless of case, and anything that is not text', () => {
    expect(parseFeatures(['Communities', '', 'communities', 42, null])).toEqual(['Communities']);
    expect(parseFeatures(undefined)).toEqual([]);
  });

  it('treats the same feature with another value as a duplicate', () => {
    expect(parseFeatures(['MaxApexCodeSize:10', 'maxapexcodesize:20', 'Communities'])).toEqual(['MaxApexCodeSize:10', 'Communities']);
  });
});

describe('parseScratchOrgDefinition', () => {
  it('reads a typical project-scratch-def.json', () => {
    const definition = parseScratchOrgDefinition(
      JSON.stringify({
        orgName: 'Demo company',
        edition: 'Developer',
        features: ['EnableSetPasswordInApi'],
        hasSampleData: true,
        release: 'preview',
        settings: {
          lightningExperienceSettings: { enableS1DesktopEnabled: true },
          mobileSettings: { enableS1EncryptedStoragePref2: false },
        },
        objectSettings: { opportunity: { sharingModel: 'private' } },
      }),
    );

    expect(definition).toEqual({
      request: {
        orgName: 'Demo company',
        edition: 'Developer',
        features: ['EnableSetPasswordInApi'],
        hasSampleData: true,
        release: 'Preview',
      },
      settings: {
        lightningExperienceSettings: { enableS1DesktopEnabled: true },
        mobileSettings: { enableS1EncryptedStoragePref2: false },
      },
      objectSettings: { opportunity: { sharingModel: 'private' } },
      warnings: [],
    });
  });

  it('warns about options that are ignored instead of dropping them silently', () => {
    const { request, warnings } = parseScratchOrgDefinition(
      JSON.stringify({ edition: 'Developer', template: '0TT000000000001', release: 'next', country: 42, $schema: 'https://example.com' }),
    );

    expect(request).toEqual({ edition: 'Developer' });
    expect(warnings).toEqual([
      '"country" was ignored because it is not text.',
      '"release" was ignored because "next" is not one of Current, Preview, Previous.',
      '"template" is not supported and was ignored.',
    ]);
  });

  it('treats empty settings as no settings', () => {
    const { settings, objectSettings } = parseScratchOrgDefinition(
      JSON.stringify({ edition: 'Developer', settings: {}, objectSettings: null }),
    );
    expect(settings).toBeNull();
    expect(objectSettings).toBeNull();
  });

  it('rejects content that is not a definition', () => {
    expect(() => parseScratchOrgDefinition('{ not json')).toThrow('not valid JSON');
    expect(() => parseScratchOrgDefinition('[]')).toThrow('must be a JSON object');
    expect(() => parseScratchOrgDefinition(JSON.stringify({ orgPreferences: { enabled: ['S1DesktopEnabled'] } }))).toThrow(
      'no longer supported',
    );
  });
});
