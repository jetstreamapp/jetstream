import { DeployResult } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  generateCustomPermissionApiName,
  getCustomPermissionMetadataXml,
  getCustomPermissionPackageXml,
  getDeployFailureMessage,
  isValidCustomPermissionApiName,
} from '../custom-permission-create-utils';

describe('generateCustomPermissionApiName', () => {
  it('should derive a valid API name from the label', () => {
    expect(generateCustomPermissionApiName('Approve Discounts > 20%')).toBe('Approve_Discounts_20');
    expect(generateCustomPermissionApiName('1st Line Support')).toBe('X1st_Line_Support');
    expect(isValidCustomPermissionApiName('Approve_Discounts')).toBe(true);
    expect(isValidCustomPermissionApiName('Approve__Discounts')).toBe(false);
    expect(isValidCustomPermissionApiName('Approve_')).toBe(false);
  });
});

describe('getCustomPermissionMetadataXml', () => {
  it('should escape the label and description and omit an empty description', () => {
    const xml = getCustomPermissionMetadataXml({ label: 'Approve <Big> & "Small"', name: 'Approve', description: "Over 20% & 'more'" });
    expect(xml).toContain('<label>Approve &lt;Big&gt; &amp; &quot;Small&quot;</label>');
    expect(xml).toContain('<description>Over 20% &amp; &#039;more&#039;</description>');
    expect(xml).toContain('<isLicensed>false</isLicensed>');
    expect(xml).toContain('xmlns="http://soap.sforce.com/2006/04/metadata"');

    expect(getCustomPermissionMetadataXml({ label: 'Approve', name: 'Approve', description: '' })).not.toContain('<description>');
  });
});

describe('getCustomPermissionPackageXml', () => {
  it('should reference the custom permission by name at the requested API version', () => {
    const xml = getCustomPermissionPackageXml('Approve_Discounts', 'v62.0');
    expect(xml).toContain('<members>Approve_Discounts</members>');
    expect(xml).toContain('<name>CustomPermission</name>');
    expect(xml).toContain('<version>62.0</version>');
  });
});

describe('getDeployFailureMessage', () => {
  it('should prefer component failure problems and fall back to the deploy error message', () => {
    const withFailures = {
      success: false,
      details: { componentFailures: [{ problem: 'Duplicate name' }, { problem: 'Invalid label' }] },
    } as unknown as DeployResult;
    expect(getDeployFailureMessage(withFailures)).toBe('Duplicate name\nInvalid label');

    // a single failure is not wrapped in an array by the API
    const withSingleFailure = { success: false, details: { componentFailures: { problem: 'Duplicate name' } } } as unknown as DeployResult;
    expect(getDeployFailureMessage(withSingleFailure)).toBe('Duplicate name');

    expect(getDeployFailureMessage({ success: false, errorMessage: 'Timed out' } as DeployResult)).toBe('Timed out');
    expect(getDeployFailureMessage({ success: false } as DeployResult)).toBe('The custom permission could not be created.');
  });
});
