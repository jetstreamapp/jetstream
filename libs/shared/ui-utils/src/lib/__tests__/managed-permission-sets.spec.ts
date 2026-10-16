import { PermissionSetRecord } from '@jetstream/types';
import {
  getManagedPermissionSetSource,
  isManagedPermissionSet,
  isSalesforceInternalPermissionSet,
  isSalesforceProvidedPermissionSet,
} from '../shared-ui-utils';

function permissionSet(overrides: Partial<PermissionSetRecord>): PermissionSetRecord {
  return {
    attributes: { type: 'PermissionSet', url: '' },
    Id: '0PS000000000001',
    Name: 'Test',
    Label: 'Test',
    Type: 'Regular',
    IsCustom: true,
    IsOwnedByProfile: false,
    NamespacePrefix: null,
    ProfileId: null,
    ...overrides,
  };
}

describe('isManagedPermissionSet', () => {
  it('treats a permission set without a namespace as editable', () => {
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: null }), null)).toBe(false);
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: null }), 'myns')).toBe(false);
  });

  it("treats a permission set in the org's own namespace as editable", () => {
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: 'myns' }), 'myns')).toBe(false);
  });

  it("compares the org's namespace case-insensitively", () => {
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: 'MyNs' }), 'myns')).toBe(false);
  });

  it('treats a permission set from another namespace as managed', () => {
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: 'SBQQ' }), 'myns')).toBe(true);
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: 'SBQQ' }), null)).toBe(true);
  });

  it('treats Salesforce standard permission sets as managed', () => {
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: 'force', Type: 'Standard', IsCustom: false }), null)).toBe(true);
  });

  it('treats a standard permission set without a namespace as managed', () => {
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: null, Type: 'Standard', IsCustom: false }), null)).toBe(true);
    expect(isManagedPermissionSet(permissionSet({ NamespacePrefix: null, Type: 'Standard', IsCustom: false }), 'myns')).toBe(true);
  });

  it('handles a missing record', () => {
    expect(isManagedPermissionSet(undefined, null)).toBe(false);
  });
});

describe('isSalesforceInternalPermissionSet', () => {
  it('hides session-based permission sets in Salesforce namespaces', () => {
    expect(isSalesforceInternalPermissionSet(permissionSet({ NamespacePrefix: 'force', Type: 'Session', IsCustom: false }))).toBe(true);
    expect(isSalesforceInternalPermissionSet(permissionSet({ NamespacePrefix: 'sfdcInternalInt', Type: 'Session' }))).toBe(true);
  });

  it('keeps Salesforce standard permission sets', () => {
    expect(isSalesforceInternalPermissionSet(permissionSet({ NamespacePrefix: 'force', Type: 'Standard', IsCustom: false }))).toBe(false);
  });

  it('keeps session-based permission sets from packages and the org itself', () => {
    expect(isSalesforceInternalPermissionSet(permissionSet({ NamespacePrefix: 'SBQQ', Type: 'Session' }))).toBe(false);
    expect(isSalesforceInternalPermissionSet(permissionSet({ NamespacePrefix: null, Type: 'Session' }))).toBe(false);
  });
});

describe('getManagedPermissionSetSource', () => {
  it('names Salesforce for Salesforce namespaces', () => {
    const record = permissionSet({ NamespacePrefix: 'force', Type: 'Standard' });
    expect(isSalesforceProvidedPermissionSet(record)).toBe(true);
    expect(getManagedPermissionSetSource(record)).toBe('Salesforce');
  });

  it('names Salesforce for a standard permission set without a namespace', () => {
    const record = permissionSet({ NamespacePrefix: null, Type: 'Standard', IsCustom: false });
    expect(isSalesforceProvidedPermissionSet(record)).toBe(true);
    expect(getManagedPermissionSetSource(record)).toBe('Salesforce');
  });

  it('names the package for other namespaces', () => {
    const record = permissionSet({ NamespacePrefix: 'SBQQ' });
    expect(isSalesforceProvidedPermissionSet(record)).toBe(false);
    expect(getManagedPermissionSetSource(record)).toBe('the SBQQ managed package');
  });
});
