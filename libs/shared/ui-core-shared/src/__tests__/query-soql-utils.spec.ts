import { FieldType as QueryFieldType, parseQuery } from '@jetstreamapp/soql-parser-js';
import { SoqlMetadataTree, __TEST_EXPORTS__ } from '../query-soql-utils';

const {
  getParsableFields,
  getParsableFieldsFromFilter,
  getParsableFieldsFromOrderBy,
  findRequiredRelationships,
  getLowercaseFieldMapWithFullPath,
} = __TEST_EXPORTS__;

describe('getParsableFields', () => {
  it('should return an empty array when given an empty array of fields', () => {
    const fields: QueryFieldType[] = [];
    const result = getParsableFields(fields);
    expect(result.fields).toEqual([]);
    expect(result.subqueries).toEqual({});
  });

  it('should return the correct fields when given an array of fields', () => {
    const fields: QueryFieldType[] = [
      { type: 'Field', field: 'Name' },
      { type: 'Field', field: 'Account.Name' },
      { type: 'Field', field: 'Account.Owner.Name' },
      { type: 'FieldRelationship', rawValue: 'Parent' },
      { type: 'FieldRelationship', rawValue: 'Parent.Account' },
      { type: 'FieldFunctionExpression', parameters: ['CreatedDate'] },
      {
        type: 'FieldTypeof',
        objectType: 'Account',
        field: 'Name',
        conditions: [
          {
            type: 'WHEN',
            objectType: 'User',
            fieldList: ['Id'],
          },
          {
            type: 'WHEN',
            objectType: 'Group',
            fieldList: ['CreatedById'],
          },
        ],
      },
      {
        type: 'FieldSubquery',
        subquery: {
          relationshipName: 'Contacts',
          fields: [
            { type: 'Field', field: 'Name' },
            { type: 'Field', field: 'Email' },
          ],
        },
      },
    ] as any;
    const result = getParsableFields(fields);
    expect(result.fields).toEqual([
      'account.name',
      'account.owner.name',
      'createddate',
      'name',
      'parent',
      'parent.account',
      'user!name.id',
    ]);
    expect(result.subqueries).toEqual({
      Contacts: ['email', 'name'],
    });
  });
});

describe('getParsableFieldsFromFilter', () => {
  it('should return an empty array when given a null filter', () => {
    const result = getParsableFieldsFromFilter(null);
    expect(result).toEqual([]);
  });

  it('should return an empty array when given a filter without value conditions', () => {
    const filter = parseQuery(
      `SELECT Id FROM Account WHERE (Id IN ('1', '2', '3') OR (NOT Id = '2') OR (Name LIKE '%FOO%' OR (Name LIKE '%ARM%' AND FOO = 'bar')))`,
    ).where;
    const result = getParsableFieldsFromFilter(filter);
    expect(result).toEqual(['id', 'name', 'foo']);
  });

  it('should return the correct fields when given a filter with value conditions', () => {
    const filter = parseQuery(`SELECT Id, Name, Account.Name FROM Contact WHERE Account.Industry = 'media'`).where;
    const result = getParsableFieldsFromFilter(filter);
    expect(result).toEqual(['account.industry']);
  });

  it('Should ignore subqueries in WHERE clause', () => {
    const filter = parseQuery(
      `SELECT Id, Name FROM Account WHERE Id IN (SELECT AccountId FROM Contact WHERE LastName LIKE 'apple%') AND Id IN (SELECT AccountId FROM Opportunity WHERE isClosed = FALSE)`,
    ).where;
    const result = getParsableFieldsFromFilter(filter);
    expect(result).toEqual([]);
  });
});

describe('getParsableFieldsFromOrderBy', () => {
  it('returns an empty array when orderBy is null/undefined', () => {
    expect(getParsableFieldsFromOrderBy(null)).toEqual([]);
    expect(getParsableFieldsFromOrderBy(undefined)).toEqual([]);
  });

  it('extracts fields from a single OrderBy clause', () => {
    const orderBy = parseQuery(`SELECT Id FROM Account ORDER BY Name DESC`).orderBy;
    expect(getParsableFieldsFromOrderBy(orderBy)).toEqual(['Name']);
  });

  it('extracts fields from multiple OrderBy clauses', () => {
    const orderBy = parseQuery(`SELECT Id FROM Account ORDER BY Name ASC, CreatedDate DESC`).orderBy;
    expect(getParsableFieldsFromOrderBy(orderBy)).toEqual(['Name', 'CreatedDate']);
  });
});

describe('getParsableFields — subquery with WHERE and ORDER BY', () => {
  it('collects fields from subquery SELECT + WHERE + ORDER BY', () => {
    const query = parseQuery(
      `SELECT Id, (SELECT Id, Name FROM Contacts WHERE Email != null AND Account.Industry = 'media' ORDER BY CreatedDate DESC LIMIT 5) FROM Account`,
    );
    const result = getParsableFields(query.fields || []);
    expect(result.subqueries['Contacts']).toEqual(expect.arrayContaining(['id', 'name', 'email', 'account.industry', 'createddate']));
    // Should not leak subquery fields into the top-level fields list
    expect(result.fields).not.toContain('email');
  });
});

describe('findRequiredRelationships', () => {
  it('should return an empty array when given an empty array of fields', () => {
    const fields: string[] = [];
    const result = findRequiredRelationships(fields);
    expect(result).toEqual([]);
  });

  it('should return the correct relationships when given an array of fields', () => {
    const fields: string[] = ['LastModifiedBy.Account.LastModifiedBy.Foo', 'Parent.Name', 'Account.Owner', 'Contact.Account.Owner'];
    const result = findRequiredRelationships(fields);
    expect(result).toEqual([
      'LastModifiedBy',
      'LastModifiedBy.Account',
      'LastModifiedBy.Account.LastModifiedBy',
      'Parent',
      'Account',
      'Contact',
      'Contact.Account',
    ]);
  });
});

describe('getLowercaseFieldMapWithFullPath', () => {
  it('should combine all lowercaseFieldMaps into one object with the full field path', () => {
    const metadata: Record<string, SoqlMetadataTree> = {
      Account: {
        key: 'Account',
        parentField: { name: 'Account', relationshipName: null } as any,
        fieldKey: 'Account',
        level: 0,
        metadata: { name: 'Account', fields: [{ name: 'Id' }, { name: 'Name' }] } as any,
        lowercaseFieldMap: { id: { name: 'Id' }, name: { name: 'Name' } } as any,
        children: [
          {
            key: 'Account.Owner',
            parentField: { name: 'Owner', relationshipName: 'Owner' } as any,
            fieldKey: 'Account.Owner',
            level: 1,
            metadata: { name: 'User', fields: [{ name: 'Id' }, { name: 'Name' }] } as any,
            lowercaseFieldMap: { id: { name: 'Id' }, name: { name: 'Name' } } as any,
            children: [],
          },
        ],
      },
    };

    const output = getLowercaseFieldMapWithFullPath(metadata);

    expect(output).toEqual({
      'Account.id': { name: 'Id' },
      'Account.name': { name: 'Name' },
      'Account.Owner.id': { name: 'Id' },
      'Account.Owner.name': { name: 'Name' },
    });
  });
});
