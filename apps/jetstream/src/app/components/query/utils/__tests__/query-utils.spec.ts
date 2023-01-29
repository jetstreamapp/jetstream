import * as queryUtils from '../query-utils';
import '@jetstream/shared/data';
import { DESCRIBE_GLOBAL_SPEC, DESCRIBE_ACCOUNT_SPEC, DESCRIBE_USER_SPEC } from './query-utils.data';
import { parseQuery } from 'soql-parser-js';
import axios from 'axios';

/**
 * this is stupid an is not working.
 * mocks are not doing anything
 */

// jest.mock('axios');
// describe('landing', () => {
//   // https://medium.com/trabe/mocking-different-values-for-the-same-module-using-jest-a7b8d358d78b
//   beforeEach(() => jest.resetModules());

//   const org: any = {};
//   const query = parseQuery(`SELECT Id, CreatedBy.Account.Id, CreatedBy.Account.Name FROM Account`);

//   jest.mock('@jetstream/shared/data', () => ({
//     responseErrorInterceptor: jest.fn(),
//     describeGlobal: DESCRIBE_GLOBAL_SPEC,
//     describeSObject: jest
//       .fn()
//       .mockReturnValueOnce(() => DESCRIBE_ACCOUNT_SPEC)
//       .mockReturnValueOnce(() => DESCRIBE_USER_SPEC)
//       .mockReturnValueOnce(() => DESCRIBE_ACCOUNT_SPEC),
//   }));

//   it('should do shit', async () => {
//     const results = await queryUtils.queryRestoreFetchData(org, query);
//     console.log('done');
//   });
// });
