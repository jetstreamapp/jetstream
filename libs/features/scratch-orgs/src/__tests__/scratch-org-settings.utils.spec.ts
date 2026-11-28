import { describe, expect, it } from 'vitest';
import { buildScratchOrgSettingsPackage, hasScratchOrgSettings } from '../scratch-org-settings.utils';

describe('hasScratchOrgSettings', () => {
  it('is true when either kind of setting is present', () => {
    expect(hasScratchOrgSettings(null, null)).toBe(false);
    expect(hasScratchOrgSettings({}, {})).toBe(false);
    expect(hasScratchOrgSettings({ mobileSettings: {} }, null)).toBe(true);
    expect(hasScratchOrgSettings(null, { account: { sharingModel: 'private' } })).toBe(true);
  });
});

describe('buildScratchOrgSettingsPackage', () => {
  it('returns nothing when there is nothing to deploy', () => {
    expect(buildScratchOrgSettingsPackage({ settings: null, objectSettings: null, apiVersion: '62.0' })).toEqual({});
  });

  it('writes one settings file per setting, the way the Salesforce CLI does', () => {
    const files = buildScratchOrgSettingsPackage({
      settings: {
        lightningExperienceSettings: { enableS1DesktopEnabled: true },
        securitySettings: { passwordPolicies: { minimumPasswordLength: 'TenCharacters' }, sessionSettings: { forceRelogin: false } },
      },
      objectSettings: null,
      apiVersion: '62.0',
    });

    expect(Object.keys(files).sort()).toEqual(['package.xml', 'settings/LightningExperience.settings', 'settings/Security.settings']);
    expect(files['settings/LightningExperience.settings']).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<LightningExperienceSettings xmlns="http://soap.sforce.com/2006/04/metadata">',
        '    <enableS1DesktopEnabled>true</enableS1DesktopEnabled>',
        '</LightningExperienceSettings>',
        '',
      ].join('\n'),
    );
    expect(files['settings/Security.settings']).toContain(
      ['    <passwordPolicies>', '        <minimumPasswordLength>TenCharacters</minimumPasswordLength>', '    </passwordPolicies>'].join(
        '\n',
      ),
    );
    expect(files['package.xml']).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
        '    <types>',
        '        <members>LightningExperience</members>',
        '        <members>Security</members>',
        '        <name>Settings</name>',
        '    </types>',
        '    <version>62.0</version>',
        '</Package>',
        '',
      ].join('\n'),
    );
  });

  it('repeats elements for arrays and escapes values', () => {
    const files = buildScratchOrgSettingsPackage({
      settings: { communitiesSettings: { labels: ['a & b', '<c>'] } },
      objectSettings: null,
      apiVersion: '62.0',
    });

    expect(files['settings/Communities.settings']).toContain('    <labels>a &amp; b</labels>\n    <labels>&lt;c&gt;</labels>');
  });

  it('skips settings that could not produce valid XML', () => {
    const files = buildScratchOrgSettingsPackage({
      settings: { 'bad name': { enabled: true }, notAnObject: true, mobileSettings: { '<bad>': true, enabled: true } },
      objectSettings: null,
      apiVersion: '62.0',
    });

    expect(Object.keys(files).sort()).toEqual(['package.xml', 'settings/Mobile.settings']);
    expect(files['settings/Mobile.settings']).not.toContain('bad');
  });

  it('creates the sharing model, record type and business process for object settings', () => {
    const files = buildScratchOrgSettingsPackage({
      settings: null,
      objectSettings: {
        opportunity: { sharingModel: 'private', defaultRecordType: 'default' },
        case: { defaultRecordType: 'support' },
        account: { sharingModel: 'readWrite', defaultRecordType: 'customer' },
      },
      apiVersion: '62.0',
    });

    expect(Object.keys(files).sort()).toEqual([
      'objects/Account.object',
      'objects/Case.object',
      'objects/Opportunity.object',
      'package.xml',
    ]);

    // Opportunity stages cannot be flagged as the default value of a business process
    expect(files['objects/Opportunity.object']).toBe(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">',
        '    <sharingModel>Private</sharingModel>',
        '    <businessProcesses>',
        '        <fullName>DefaultProcess</fullName>',
        '        <isActive>true</isActive>',
        '        <values>',
        '            <fullName>Prospecting</fullName>',
        '        </values>',
        '    </businessProcesses>',
        '    <recordTypes>',
        '        <fullName>Default</fullName>',
        '        <label>Default</label>',
        '        <active>true</active>',
        '        <businessProcess>DefaultProcess</businessProcess>',
        '    </recordTypes>',
        '</CustomObject>',
        '',
      ].join('\n'),
    );
    expect(files['objects/Case.object']).toContain('            <fullName>New</fullName>\n            <default>true</default>');
    // Account record types do not need a business process
    expect(files['objects/Account.object']).not.toContain('businessProcess');
    expect(files['objects/Account.object']).toContain('<sharingModel>ReadWrite</sharingModel>');

    expect(files['package.xml']).toContain(
      [
        '    <types>',
        '        <members>Opportunity.Default</members>',
        '        <members>Case.Support</members>',
        '        <members>Account.Customer</members>',
        '        <name>RecordType</name>',
        '    </types>',
        '    <types>',
        '        <members>Opportunity.DefaultProcess</members>',
        '        <members>Case.SupportProcess</members>',
        '        <name>BusinessProcess</name>',
        '    </types>',
      ].join('\n'),
    );
  });
});
