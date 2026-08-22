import { getQueryForCustomFieldAudit } from '../permission-manager-utils';

describe('getQueryForCustomFieldAudit', () => {
  it('should select the audit fields plus the pieces the FieldDefinitionId join key is built from', () => {
    const [query] = getQueryForCustomFieldAudit(['Account']);
    ['Id', 'EntityDefinitionId', 'CreatedDate', 'CreatedBy.Name', 'LastModifiedDate', 'LastModifiedBy.Name'].forEach((field) => {
      expect(query).toContain(field);
    });
    expect(query).toContain('FROM CustomField');
  });

  it('should filter to the provided objects', () => {
    const [query] = getQueryForCustomFieldAudit(['Account', 'Contact']);
    expect(query).toContain("EntityDefinition.QualifiedApiName IN ('Account', 'Contact')");
  });

  it('should keep a typical selection in a single query', () => {
    const sobjects = Array.from({ length: 100 }, (_, i) => `Object_${i}__c`);
    expect(getQueryForCustomFieldAudit(sobjects)).toHaveLength(1);
  });

  it('should split selections that exceed the max objects per query without dropping any object', () => {
    const sobjects = Array.from({ length: 250 }, (_, i) => `Object_${i}__c`);
    const queries = getQueryForCustomFieldAudit(sobjects);

    expect(queries).toHaveLength(3);
    sobjects.forEach((sobject) => {
      expect(queries.some((query) => query.includes(`'${sobject}'`))).toBe(true);
    });
  });

  // Unreachable from the editor, which always has at least one object selected. Asserted only to pin the
  // shape to the sibling query builders, which all emit a single query for an empty selection.
  it('should not throw on an empty selection', () => {
    expect(getQueryForCustomFieldAudit([])).toHaveLength(1);
  });
});
