import { getPermissionableFieldObjectChunks, getQueryForAllPermissionableFields } from '../permission-manager-utils';

describe('getQueryForAllPermissionableFields', () => {
  it('should order by DurableId first so that cursor paging can resume where the prior page ended', () => {
    const query = getQueryForAllPermissionableFields(['Account']);
    expect(query).toContain('ORDER BY DurableId ASC, EntityDefinitionId ASC, QualifiedApiName ASC');
  });

  it('should filter to permissionable, non-component particles for the provided objects', () => {
    const query = getQueryForAllPermissionableFields(['Account', 'Contact']);
    expect(query).toContain("EntityDefinition.QualifiedApiName IN ('Account', 'Contact')");
    expect(query).toContain('IsPermissionable = TRUE');
    expect(query).toContain('IsComponent = FALSE');
  });

  it('should omit the cursor filter for the first page', () => {
    expect(getQueryForAllPermissionableFields(['Account'])).not.toContain('DurableId >');
    expect(getQueryForAllPermissionableFields(['Account'], null)).not.toContain('DurableId >');
    expect(getQueryForAllPermissionableFields(['Account'], undefined)).not.toContain('DurableId >');
  });

  it('should resume after the provided cursor while keeping all other filters', () => {
    const query = getQueryForAllPermissionableFields(['Account', 'Contact'], 'Account.AccountNumber');
    expect(query).toContain("DurableId > 'Account.AccountNumber'");
    expect(query).toContain("EntityDefinition.QualifiedApiName IN ('Account', 'Contact')");
    expect(query).toContain('IsPermissionable = TRUE');
    expect(query).toContain('IsComponent = FALSE');
    // Every filter must be ANDed together, otherwise the cursor would widen rather than narrow results
    expect(query).not.toContain(' OR ');
  });

  it('should select the fields the permission table depends on, including the cursor field', () => {
    const query = getQueryForAllPermissionableFields(['Account']);
    ['QualifiedApiName', 'Label', 'DataType', 'DurableId', 'EntityDefinition.QualifiedApiName', 'IsPermissionable'].forEach((field) => {
      expect(query).toContain(field);
    });
  });
});

describe('getPermissionableFieldObjectChunks', () => {
  it('should keep a typical selection in a single query', () => {
    const sobjects = Array.from({ length: 100 }, (_, i) => `Object_${i}__c`);
    expect(getPermissionableFieldObjectChunks(sobjects)).toHaveLength(1);
  });

  it('should split selections that exceed the max objects per query', () => {
    const sobjects = Array.from({ length: 250 }, (_, i) => `Object_${i}__c`);
    const chunks = getPermissionableFieldObjectChunks(sobjects);

    expect(chunks).toHaveLength(3);
    expect(chunks.flat()).toEqual(sobjects);
  });

  it('should handle an empty selection', () => {
    expect(getPermissionableFieldObjectChunks([]).flat()).toEqual([]);
  });
});
