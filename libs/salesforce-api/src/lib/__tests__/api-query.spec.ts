import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiConnection } from '../connection';
import { Logger } from '../types';

const NOOP_LOG = () => undefined;
const testLogger: Logger = { trace: NOOP_LOG, debug: NOOP_LOG, info: NOOP_LOG, warn: NOOP_LOG, error: NOOP_LOG };

const apiRequest = vi.fn();

function buildConnection() {
  return new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: (() => apiRequest) as never,
    apiVersion: '62.0',
    instanceUrl: 'https://test.my.salesforce.com',
    organizationId: '00D000000000001AAA',
    userId: '005000000000001AAA',
    callOptions: {},
    enableLogging: false,
    refreshToken: 'test',
    logger: testLogger,
  });
}

describe('caller-supplied Salesforce paths', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue({ done: true, totalSize: 0, records: [] });
  });

  describe('ApiQuery.queryMore', () => {
    it('requests a query locator path with the org credentials', async () => {
      const connection = buildConnection();

      await connection.query.queryMore('/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000');

      expect(apiRequest).toHaveBeenCalledWith(expect.objectContaining({ url: '/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000' }));
    });

    it.each([
      '/services/data/v62.0/tooling/executeAnonymous/?anonymousBody=System.debug(1)',
      '/services/apexrest/my-handler',
      '/services/data/v62.0/sobjects/Account/001000000000001AAA',
      'https://test.my.salesforce.com/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000',
      '',
    ])('refuses anything that is not a query locator before any request is made (%s)', async (nextRecordsUrl) => {
      const connection = buildConnection();

      await expect(connection.query.queryMore(nextRecordsUrl)).rejects.toThrow('query locator');
      expect(apiRequest).not.toHaveBeenCalled();
    });
  });

  describe('ApiOrg.streamDownload', () => {
    it('streams a record blob field', async () => {
      const connection = buildConnection();

      await connection.org.streamDownload('/services/data/v62.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData');

      expect(apiRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '/services/data/v62.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData',
          outputType: 'stream',
        }),
      );
    });

    it.each([
      '/services/data/v62.0/tooling/executeAnonymous/?anonymousBody=System.debug(1)',
      '/services/data/v62.0/query?q=SELECT+Id+FROM+Account',
      '/services/data/v62.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData?x=%27',
      '/services/data/v62.0/sobjects/ContentVersion/068Dn00000BSXTsIAP',
    ])('refuses anything that is not a record blob field before any request is made (%s)', async (url) => {
      const connection = buildConnection();

      await expect(connection.org.streamDownload(url)).rejects.toThrow('blob field');
      expect(apiRequest).not.toHaveBeenCalled();
    });
  });
});
