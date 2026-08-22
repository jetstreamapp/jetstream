import { CustomFieldAuditRecord } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { getFieldDefinitionKeyFromCustomField } from '../permission-manager-utils';

function buildCustomFieldAuditRecord(entityDefinitionId: string, id: string): CustomFieldAuditRecord {
  return {
    Id: id,
    EntityDefinitionId: entityDefinitionId,
    CreatedDate: '2020-04-22T14:48:23.000+0000',
    CreatedBy: { Name: 'Austin Turner' },
    LastModifiedDate: '2022-05-15T19:44:02.000+0000',
    LastModifiedBy: { Name: 'Someone Else' },
  };
}

describe('getFieldDefinitionKeyFromCustomField', () => {
  it('should use the object api name for a custom field on a standard object', () => {
    expect(getFieldDefinitionKeyFromCustomField(buildCustomFieldAuditRecord('Account', '00N6g00000Rc0yCEAR'))).toBe(
      'Account.00N6g00000Rc0yC',
    );
  });

  it('should use the CustomObject id for a custom field on a custom object', () => {
    expect(getFieldDefinitionKeyFromCustomField(buildCustomFieldAuditRecord('01I6g000002yklE', '00N6g00000RcHOXEA3'))).toBe(
      '01I6g000002yklE.00N6g00000RcHOX',
    );
  });

  it('should truncate an 18 character id to the 15 character form FieldDefinitionId embeds', () => {
    const key = getFieldDefinitionKeyFromCustomField(buildCustomFieldAuditRecord('Contact', '00N8b00000AbCdEfGH'));
    expect(key).toBe('Contact.00N8b00000AbCdE');
    expect(key.split('.')[1]).toHaveLength(15);
  });

  it('should leave a 15 character id unchanged', () => {
    expect(getFieldDefinitionKeyFromCustomField(buildCustomFieldAuditRecord('Account', '00N6g00000Rc0yC'))).toBe('Account.00N6g00000Rc0yC');
  });
});
