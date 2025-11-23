import { QueryFieldWithPolymorphic } from '@jetstream/types';
import { sortQueryFieldsPolymorphicComparable, transformTabularDataToExcelStr } from './shared-ui-utils';

describe('SHARED UI UTILS', () => {
  describe('transformTabularDataToExcelStr', () => {
    it('should work with standard data', () => {
      const data = [
        { a: 'a', b: 'b', c: 'c' },
        { a: 'a\na', b: 'be "yourself"', c: '"c"' },
      ];

      const result = transformTabularDataToExcelStr(data);

      expect(result).toEqual(`a\tb\tc\na\tb\tc\n"a\na"\t"be ""yourself"""\t"""c"""`);
    });

    it('should return empty string if there is no data', () => {
      expect('').toEqual(transformTabularDataToExcelStr('data' as any));
      expect('').toEqual(transformTabularDataToExcelStr([]));
      expect('').toEqual(transformTabularDataToExcelStr(null as any));
    });

    it('should use fields if provided', () => {
      const data = [
        { a: 'a', b: 'b', c: 'c' },
        { a: 'a', b: 'b', c: 'c' },
      ];

      const result = transformTabularDataToExcelStr(data, ['a']);

      expect(result).toEqual(`a\na\na`);
    });

    it('should handle fields that are missing from data', () => {
      const data = [
        { a: 'a', b: 'b', c: 'c' },
        { a: 'a', b: 'b', c: 'c' },
      ];

      const result = transformTabularDataToExcelStr(data, ['a', 'z']);

      expect(result).toEqual(`a\tz\na\t\na\t`);
    });
  });

  describe('sortQueryFieldsPolymorphic', () => {
    it('Should sort Id, Name, then the rest', () => {
      const fields: QueryFieldWithPolymorphic[] = [
        { field: 'FirstName', polymorphicObj: undefined },
        { field: 'Name', polymorphicObj: undefined },
        { field: 'Id', polymorphicObj: undefined },
      ];

      expect(fields.sort(sortQueryFieldsPolymorphicComparable)).toEqual([
        { field: 'Id', polymorphicObj: undefined },
        { field: 'Name', polymorphicObj: undefined },
        { field: 'FirstName', polymorphicObj: undefined },
      ]);
    });

    it('Should sort relationship fields with the Id first', () => {
      const fields: QueryFieldWithPolymorphic[] = [
        { field: 'FirstName', polymorphicObj: undefined },
        { field: 'Name', polymorphicObj: undefined },
        { field: 'Id', polymorphicObj: undefined },
        { field: 'Owner.Account.a_new_external_id_field__c', polymorphicObj: undefined },
        { field: 'Owner.Account.Id', polymorphicObj: undefined },
        { field: 'Owner.Account.Name', polymorphicObj: undefined },
        { field: 'Owner.Id', polymorphicObj: 'User' },
      ];

      expect(fields.sort(sortQueryFieldsPolymorphicComparable)).toEqual([
        { field: 'Id', polymorphicObj: undefined },
        { field: 'Name', polymorphicObj: undefined },
        { field: 'FirstName', polymorphicObj: undefined },
        { field: 'Owner.Id', polymorphicObj: 'User' },
        { field: 'Owner.Account.Id', polymorphicObj: undefined },
        { field: 'Owner.Account.Name', polymorphicObj: undefined },
        { field: 'Owner.Account.a_new_external_id_field__c', polymorphicObj: undefined },
      ]);
    });

    it('Should sort lost of relationships properly', () => {
      const fields: QueryFieldWithPolymorphic[] = [
        { field: 'Address', polymorphicObj: undefined },
        { field: 'ConvertedAccount.atg_GL_Treatment__r.Id', polymorphicObj: undefined },
        { field: 'ConvertedAccount.Id', polymorphicObj: undefined },
        { field: 'ConvertedAccount.Name', polymorphicObj: undefined },
        { field: 'ConvertedAccountId', polymorphicObj: undefined },
        { field: 'ConvertedContactId', polymorphicObj: undefined },
        { field: 'ConvertedDate', polymorphicObj: undefined },
        { field: 'ConvertedOpportunityId', polymorphicObj: undefined },
        { field: 'Country', polymorphicObj: undefined },
        { field: 'DandbCompany.Id', polymorphicObj: undefined },
        { field: 'DandbCompany.Name', polymorphicObj: undefined },
        { field: 'Id', polymorphicObj: undefined },
        { field: 'Name', polymorphicObj: undefined },
        { field: 'Owner.Account.Id', polymorphicObj: undefined },
        { field: 'Owner.Account.Name', polymorphicObj: undefined },
        { field: 'Owner.Contact.AccountId', polymorphicObj: undefined },
        { field: 'Owner.Contact.Id', polymorphicObj: undefined },
        { field: 'Owner.Contact.Name', polymorphicObj: undefined },
        { field: 'Owner.Id', polymorphicObj: 'User' },
        { field: 'Owner.IsActive', polymorphicObj: 'User' },
        { field: 'Owner.Name', polymorphicObj: 'User' },
        { field: 'PartnerAccount.blng__BillToContact__r.Account.Id', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Account.Name', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Id', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Name', polymorphicObj: undefined },
        { field: 'PartnerAccount.Id', polymorphicObj: undefined },
        { field: 'PartnerAccount.Name', polymorphicObj: undefined },
      ];

      expect(fields.sort(sortQueryFieldsPolymorphicComparable)).toEqual([
        { field: 'Id', polymorphicObj: undefined },
        { field: 'Name', polymorphicObj: undefined },
        { field: 'Address', polymorphicObj: undefined },
        { field: 'ConvertedAccount.Id', polymorphicObj: undefined },
        { field: 'ConvertedAccount.Name', polymorphicObj: undefined },
        { field: 'ConvertedAccount.atg_GL_Treatment__r.Id', polymorphicObj: undefined },
        { field: 'ConvertedAccountId', polymorphicObj: undefined },
        { field: 'ConvertedContactId', polymorphicObj: undefined },
        { field: 'ConvertedDate', polymorphicObj: undefined },
        { field: 'ConvertedOpportunityId', polymorphicObj: undefined },
        { field: 'Country', polymorphicObj: undefined },
        { field: 'DandbCompany.Id', polymorphicObj: undefined },
        { field: 'DandbCompany.Name', polymorphicObj: undefined },
        { field: 'Owner.Id', polymorphicObj: 'User' },
        { field: 'Owner.Name', polymorphicObj: 'User' },
        { field: 'Owner.Account.Id', polymorphicObj: undefined },
        { field: 'Owner.Account.Name', polymorphicObj: undefined },
        { field: 'Owner.Contact.Id', polymorphicObj: undefined },
        { field: 'Owner.Contact.Name', polymorphicObj: undefined },
        { field: 'Owner.Contact.AccountId', polymorphicObj: undefined },
        { field: 'Owner.IsActive', polymorphicObj: 'User' },
        { field: 'PartnerAccount.Id', polymorphicObj: undefined },
        { field: 'PartnerAccount.Name', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Id', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Name', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Account.Id', polymorphicObj: undefined },
        { field: 'PartnerAccount.blng__BillToContact__r.Account.Name', polymorphicObj: undefined },
      ]);
    });
  });
});
