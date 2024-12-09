import { REGEX } from '@jetstream/shared/utils';
import { composeQuery, getField, WhereClause } from '@jetstreamapp/soql-parser-js';

export function getSearchUserSoql(value: string) {
  let whereClause: WhereClause = {
    left: {
      field: 'Name',
      operator: 'LIKE',
      value: `%${value}%`,
      literalType: 'STRING',
    },
    operator: 'OR',
    right: {
      left: {
        field: 'Email',
        operator: 'LIKE',
        value: `%${value}%`,
        literalType: 'STRING',
      },
      operator: 'OR',
      right: {
        left: {
          field: 'Username',
          operator: 'LIKE',
          value: `%${value}%`,
          literalType: 'STRING',
        },
      },
    },
  };

  if (REGEX.SFDC_ID.test(value)) {
    whereClause = {
      left: {
        field: 'Id',
        operator: '=',
        value,
        literalType: 'STRING',
      },
      operator: 'OR',
      right: whereClause,
    };
  }

  const soql = composeQuery({
    fields: [
      getField('Id'),
      getField('Name'),
      getField('Alias'),
      getField('FORMAT(CreatedDate)'),
      getField('Email'),
      getField('IsActive'),
      getField('Profile.Id'),
      getField('Profile.Name'),
      getField('Username'),
      getField('UserRole.Id'),
      getField('UserRole.Name'),
      getField('UserType'),
    ],
    sObject: 'User',
    where: value ? whereClause : undefined,
    orderBy: [{ field: 'Name' }],
    limit: 50,
  });

  return soql;
}
