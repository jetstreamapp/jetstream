import { describe, expect, it } from 'vitest';
import {
  compareFeatureNames,
  formatScratchOrgFeature,
  getKnownScratchOrgFeature,
  getScratchOrgFeatureProblems,
  KNOWN_SCRATCH_ORG_FEATURES,
  normalizeScratchOrgFeatures,
  parseScratchOrgFeature,
} from '../scratch-org-features';

describe('KNOWN_SCRATCH_ORG_FEATURES', () => {
  it('is alphabetical and has no duplicates', () => {
    const names = KNOWN_SCRATCH_ORG_FEATURES.map(({ name }) => name);
    expect(names).toEqual([...names].sort(compareFeatureNames));
    expect(new Set(names.map((name) => name.toLowerCase())).size).toBe(names.length);
  });

  it('finds a feature regardless of case', () => {
    expect(getKnownScratchOrgFeature('communities')).toEqual({ name: 'Communities', requiresValue: false });
    expect(getKnownScratchOrgFeature('MAXAPEXCODESIZE')).toMatchObject({ name: 'MaxApexCodeSize', requiresValue: true });
    expect(getKnownScratchOrgFeature('SomethingNew')).toBeUndefined();
  });
});

describe('parseScratchOrgFeature', () => {
  it('splits the name from the value', () => {
    expect(parseScratchOrgFeature('Communities')).toEqual({ name: 'Communities', value: null });
    expect(parseScratchOrgFeature('MaxApexCodeSize:10')).toEqual({ name: 'MaxApexCodeSize', value: '10' });
    expect(parseScratchOrgFeature('EducationCloud: 5')).toEqual({ name: 'EducationCloud', value: '5' });
    expect(parseScratchOrgFeature('MaxApexCodeSize:')).toEqual({ name: 'MaxApexCodeSize', value: '' });
  });

  it('uses the documented spelling and keeps the spelling of anything else', () => {
    expect(parseScratchOrgFeature('servicecloud')).toEqual({ name: 'ServiceCloud', value: null });
    expect(parseScratchOrgFeature('someNewFeature:2')).toEqual({ name: 'someNewFeature', value: '2' });
  });

  it('round trips through formatScratchOrgFeature', () => {
    ['Communities', 'MaxApexCodeSize:10', 'SomethingNew:2', 'AddCustomApps:'].forEach((feature) => {
      expect(formatScratchOrgFeature(parseScratchOrgFeature(feature))).toBe(feature);
    });
  });
});

describe('normalizeScratchOrgFeatures', () => {
  it('drops a blank value unless the feature requires one', () => {
    expect(normalizeScratchOrgFeatures(['BenefitManagement:', 'BenefitManagement:2', 'SomethingNew:', 'AddCustomApps:'])).toEqual([
      'BenefitManagement',
      'BenefitManagement:2',
      'SomethingNew',
      'AddCustomApps:',
    ]);
  });
});

describe('getScratchOrgFeatureProblems', () => {
  it('accepts documented features, optional values and features it does not know', () => {
    expect(
      getScratchOrgFeatureProblems(['Communities', 'AddCustomApps:5', 'BenefitManagement:2', 'SomethingNew', 'SomethingNew:abc']),
    ).toEqual([]);
  });

  it('reports a required value that is missing or not a whole number', () => {
    expect(getScratchOrgFeatureProblems(['AddCustomApps', 'MaxApexCodeSize:', 'CalloutSizeMB:1.5'])).toEqual([
      'AddCustomApps requires a value',
      'MaxApexCodeSize requires a value',
      'The value of CalloutSizeMB must be a whole number',
    ]);
  });
});
