import { salesforceApi } from '../salesforce-api-callout-adapater';

describe('salesforceApi', () => {
  it('should work', () => {
    expect(salesforceApi()).toEqual('salesforce-api');
  });
});
