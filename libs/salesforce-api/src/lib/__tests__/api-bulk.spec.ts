import { describe, it, expect, vi } from 'vitest';
import { ApiBulk } from '../api-bulk';
import { ApiConnection } from '../connection';
import { getApiRequestFactoryFn } from '../callout-adapter';
import type { BulkApiCreateJobRequestPayload } from '@jetstream/types';

// Real XML responses from Salesforce Bulk API
const BULK_XML_RESPONSES = {
  JOB_INFO_OPEN: `<?xml version="1.0" encoding="UTF-8"?><jobInfo
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <id>750Kf00000R1wzRIAR</id>
 <operation>update</operation>
 <object>Account</object>
 <createdById>0056g000004tCpaAAE</createdById>
 <createdDate>2026-02-12T15:43:48.000Z</createdDate>
 <systemModstamp>2026-02-12T15:43:48.000Z</systemModstamp>
 <state>Open</state>
 <concurrencyMode>Parallel</concurrencyMode>
 <contentType>CSV</contentType>
 <numberBatchesQueued>0</numberBatchesQueued>
 <numberBatchesInProgress>0</numberBatchesInProgress>
 <numberBatchesCompleted>0</numberBatchesCompleted>
 <numberBatchesFailed>0</numberBatchesFailed>
 <numberBatchesTotal>0</numberBatchesTotal>
 <numberRecordsProcessed>0</numberRecordsProcessed>
 <numberRetries>0</numberRetries>
 <apiVersion>65.0</apiVersion>
 <numberRecordsFailed>0</numberRecordsFailed>
 <totalProcessingTime>0</totalProcessingTime>
 <apiActiveProcessingTime>0</apiActiveProcessingTime>
 <apexProcessingTime>0</apexProcessingTime>
</jobInfo>`,

  JOB_INFO_CLOSED: `<?xml version="1.0" encoding="UTF-8"?><jobInfo
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <id>750Kf00000R1wzRIAR</id>
 <operation>update</operation>
 <object>Account</object>
 <createdById>0056g000004tCpaAAE</createdById>
 <createdDate>2026-02-12T15:43:48.000Z</createdDate>
 <systemModstamp>2026-02-12T15:44:11.000Z</systemModstamp>
 <state>Closed</state>
 <concurrencyMode>Parallel</concurrencyMode>
 <contentType>CSV</contentType>
 <numberBatchesQueued>0</numberBatchesQueued>
 <numberBatchesInProgress>0</numberBatchesInProgress>
 <numberBatchesCompleted>1</numberBatchesCompleted>
 <numberBatchesFailed>0</numberBatchesFailed>
 <numberBatchesTotal>1</numberBatchesTotal>
 <numberRecordsProcessed>251</numberRecordsProcessed>
 <numberRetries>0</numberRetries>
 <apiVersion>65.0</apiVersion>
 <numberRecordsFailed>251</numberRecordsFailed>
 <totalProcessingTime>741</totalProcessingTime>
 <apiActiveProcessingTime>497</apiActiveProcessingTime>
 <apexProcessingTime>0</apexProcessingTime>
</jobInfo>`,

  BATCH_INFO_QUEUED: `<?xml version="1.0" encoding="UTF-8"?><batchInfo
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <id>751Kf000018uaV7IAI</id>
 <jobId>750Kf00000R1wzRIAR</jobId>
 <state>Queued</state>
 <createdDate>2026-02-12T15:44:04.000Z</createdDate>
 <systemModstamp>2026-02-12T15:44:04.000Z</systemModstamp>
 <numberRecordsProcessed>0</numberRecordsProcessed>
 <numberRecordsFailed>0</numberRecordsFailed>
 <totalProcessingTime>0</totalProcessingTime>
 <apiActiveProcessingTime>0</apiActiveProcessingTime>
 <apexProcessingTime>0</apexProcessingTime>
</batchInfo>`,

  BATCH_INFO_COMPLETED: `<?xml version="1.0" encoding="UTF-8"?><batchInfo
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <id>751Kf000018uaV7IAI</id>
 <jobId>750Kf00000R1wzRIAR</jobId>
 <state>Completed</state>
 <createdDate>2026-02-12T15:44:04.000Z</createdDate>
 <systemModstamp>2026-02-12T15:44:06.000Z</systemModstamp>
 <numberRecordsProcessed>251</numberRecordsProcessed>
 <numberRecordsFailed>251</numberRecordsFailed>
 <totalProcessingTime>741</totalProcessingTime>
 <apiActiveProcessingTime>497</apiActiveProcessingTime>
 <apexProcessingTime>0</apexProcessingTime>
</batchInfo>`,

  BATCH_INFO_LIST_SINGLE: `<?xml version="1.0" encoding="UTF-8"?><batchInfoList
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <batchInfo>
  <id>751Kf000018uaV7IAI</id>
  <jobId>750Kf00000R1wzRIAR</jobId>
  <state>Completed</state>
  <createdDate>2026-02-12T15:44:04.000Z</createdDate>
  <systemModstamp>2026-02-12T15:44:06.000Z</systemModstamp>
  <numberRecordsProcessed>251</numberRecordsProcessed>
  <numberRecordsFailed>251</numberRecordsFailed>
  <totalProcessingTime>741</totalProcessingTime>
  <apiActiveProcessingTime>497</apiActiveProcessingTime>
  <apexProcessingTime>0</apexProcessingTime>
 </batchInfo>
</batchInfoList>`,

  BATCH_INFO_LIST_MULTIPLE: `<?xml version="1.0" encoding="UTF-8"?><batchInfoList
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <batchInfo>
  <id>751Kf000018uaV7IAI</id>
  <jobId>750Kf00000R1wzRIAR</jobId>
  <state>Completed</state>
  <numberRecordsProcessed>100</numberRecordsProcessed>
  <numberRecordsFailed>50</numberRecordsFailed>
 </batchInfo>
 <batchInfo>
  <id>751Kf000018uaV8IAI</id>
  <jobId>750Kf00000R1wzRIAR</jobId>
  <state>Completed</state>
  <numberRecordsProcessed>151</numberRecordsProcessed>
  <numberRecordsFailed>201</numberRecordsFailed>
 </batchInfo>
</batchInfoList>`,

  BATCH_INFO_LIST_EMPTY: `<?xml version="1.0" encoding="UTF-8"?><batchInfoList
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
</batchInfoList>`,

  RESULT_LIST_SINGLE: `<?xml version="1.0" encoding="UTF-8"?><result-list
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <result>752Kf000018uaV9IAI</result>
</result-list>`,

  RESULT_LIST_MULTIPLE: `<?xml version="1.0" encoding="UTF-8"?><result-list
   xmlns="http://www.force.com/2009/06/asyncapi/dataload">
 <result>752Kf000018uaV9IAI</result>
 <result>752Kf000018uaVAIAI</result>
 <result>752Kf000018uaVBIAI</result>
</result-list>`,
};

// Helper to create a mock fetch that returns XML
const createMockFetch = (responses: Record<string, string>) => {
  return vi.fn((url: string | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Find the most specific matching key (longest match wins to handle nested URLs)
    const matchedKey = Object.keys(responses)
      .filter((key) => urlStr.includes(key))
      .sort((a, b) => b.length - a.length)[0];

    if (!matchedKey) {
      throw new Error(`No mock response for URL: ${urlStr}`);
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Headers({ 'content-type': 'text/xml; charset=UTF-8' }),
      type: 'basic' as ResponseType,
      url: urlStr,
      text: () => Promise.resolve(responses[matchedKey]),
      json: () => Promise.reject(new Error('Not JSON')),
      clone() {
        return this;
      },
    } as any);
  });
};

// Helper to create connection with real XML parsing
const createConnectionWithXmlParsing = (mockFetch: any) => {
  const apiRequest = getApiRequestFactoryFn(mockFetch)();
  return {
    apiRequest,
    sessionInfo: {
      accessToken: 'test-token',
      instanceUrl: 'https://test.salesforce.com',
      apiVersion: '65.0',
      userId: 'test-user-id',
      organizationId: 'test-org-id',
    },
    logger: console,
  } as unknown as ApiConnection;
};

describe('ApiBulk XML parsing and type handling', () => {
  describe('createJob - XML parsing and type conversion', () => {
    it('should parse XML jobInfo and convert string numbers to actual numbers', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job': BULK_XML_RESPONSES.JOB_INFO_OPEN,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const payload: BulkApiCreateJobRequestPayload = {
        type: 'UPDATE',
        sObject: 'Account',
      };

      const result = await apiBulk.createJob(payload);

      // Verify the result structure from parsed XML
      expect(result).toBeDefined();
      expect(result.id).toBe('750Kf00000R1wzRIAR');
      expect(result.operation).toBe('update');
      expect(result.state).toBe('Open');

      // CRITICAL: Verify that bulkApiEnsureTyped converted string numbers to actual numbers
      expect(typeof result.numberBatchesQueued).toBe('number');
      expect(typeof result.numberBatchesInProgress).toBe('number');
      expect(typeof result.numberBatchesCompleted).toBe('number');
      expect(typeof result.numberBatchesFailed).toBe('number');
      expect(typeof result.numberBatchesTotal).toBe('number');
      expect(typeof result.numberRecordsProcessed).toBe('number');
      expect(typeof result.numberRetries).toBe('number');
      expect(typeof result.apiVersion).toBe('number');
      expect(typeof result.numberRecordsFailed).toBe('number');
      expect(typeof result.totalProcessingTime).toBe('number');
      expect(typeof result.apiActiveProcessingTime).toBe('number');
      expect(typeof result.apexProcessingTime).toBe('number');

      // Verify actual values
      expect(result.numberBatchesTotal).toBe(0);
      expect(result.numberRecordsProcessed).toBe(0);
      expect(result.apiVersion).toBe(65);
    });

    it('should handle closed job state with large numeric values', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job': BULK_XML_RESPONSES.JOB_INFO_CLOSED,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const payload: BulkApiCreateJobRequestPayload = {
        type: 'UPDATE',
        sObject: 'Account',
      };

      const result = await apiBulk.createJob(payload);

      expect(result.state).toBe('Closed');
      expect(result.numberBatchesCompleted).toBe(1);
      expect(result.numberRecordsProcessed).toBe(251);
      expect(result.numberRecordsFailed).toBe(251);
      expect(result.totalProcessingTime).toBe(741);

      // All should be numbers, not strings
      expect(typeof result.numberBatchesCompleted).toBe('number');
      expect(typeof result.numberRecordsProcessed).toBe('number');
    });
  });

  describe('getJob - XML parsing with parallel requests', () => {
    it('should parse jobInfo and single batchInfo from XML', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job/750Kf00000R1wzRIAR': BULK_XML_RESPONSES.JOB_INFO_CLOSED,
        '/services/async/65.0/job/750Kf00000R1wzRIAR/batch': BULK_XML_RESPONSES.BATCH_INFO_LIST_SINGLE,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const result = await apiBulk.getJob('750Kf00000R1wzRIAR');

      // Verify job info parsed and typed correctly
      expect(result.id).toBe('750Kf00000R1wzRIAR');
      expect(result.state).toBe('Closed');
      expect(typeof result.numberBatchesCompleted).toBe('number');
      expect(result.numberBatchesCompleted).toBe(1);

      // Verify batches are properly parsed and typed
      expect(Array.isArray(result.batches)).toBe(true);
      expect(result.batches.length).toBe(1);
      expect(result.batches[0].id).toBe('751Kf000018uaV7IAI');
      expect(result.batches[0].state).toBe('Completed');

      // CRITICAL: Numbers should be converted from XML strings
      expect(typeof result.batches[0].numberRecordsProcessed).toBe('number');
      expect(result.batches[0].numberRecordsProcessed).toBe(251);
      expect(typeof result.batches[0].numberRecordsFailed).toBe('number');
      expect(result.batches[0].numberRecordsFailed).toBe(251);
    });

    it('should handle multiple batches in XML batchInfoList', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job/750Kf00000R1wzRIAR': BULK_XML_RESPONSES.JOB_INFO_CLOSED,
        '/services/async/65.0/job/750Kf00000R1wzRIAR/batch': BULK_XML_RESPONSES.BATCH_INFO_LIST_MULTIPLE,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const result = await apiBulk.getJob('750Kf00000R1wzRIAR');

      // Verify multiple batches parsed correctly
      expect(result.batches.length).toBe(2);

      // First batch
      expect(typeof result.batches[0].numberRecordsProcessed).toBe('number');
      expect(result.batches[0].numberRecordsProcessed).toBe(100);
      expect(result.batches[0].numberRecordsFailed).toBe(50);

      // Second batch
      expect(typeof result.batches[1].numberRecordsProcessed).toBe('number');
      expect(result.batches[1].numberRecordsProcessed).toBe(151);
      expect(result.batches[1].numberRecordsFailed).toBe(201);
    });

    it('should handle empty batchInfoList XML', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job/750Kf00000R1wzRIAR': BULK_XML_RESPONSES.JOB_INFO_OPEN,
        '/services/async/65.0/job/750Kf00000R1wzRIAR/batch': BULK_XML_RESPONSES.BATCH_INFO_LIST_EMPTY,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const result = await apiBulk.getJob('750Kf00000R1wzRIAR');

      // Empty XML should result in empty array
      expect(result.batches).toEqual([]);
    });
  });

  describe('addBatchToJob - XML parsing', () => {
    it('should parse batchInfo XML and convert numeric fields', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job/750Kf00000R1wzRIAR/batch': BULK_XML_RESPONSES.BATCH_INFO_QUEUED,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const result = await apiBulk.addBatchToJob('csv,data', '750Kf00000R1wzRIAR');

      expect(result.id).toBe('751Kf000018uaV7IAI');
      expect(result.jobId).toBe('750Kf00000R1wzRIAR');
      expect(result.state).toBe('Queued');

      // Verify type conversions
      expect(typeof result.numberRecordsProcessed).toBe('number');
      expect(result.numberRecordsProcessed).toBe(0);
      expect(typeof result.numberRecordsFailed).toBe('number');
      expect(result.numberRecordsFailed).toBe(0);
    });
  });

  describe('getQueryResultsJobIds - XML parsing', () => {
    it('should parse result-list XML with single result', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job/750Kf00000R1wzRIAR/batch/751Kf000018uaV7IAI/result':
          BULK_XML_RESPONSES.RESULT_LIST_SINGLE,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const result = await apiBulk.getQueryResultsJobIds('750Kf00000R1wzRIAR', '751Kf000018uaV7IAI');

      // Single result should become an array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0]).toBe('752Kf000018uaV9IAI');
    });

    it('should parse result-list XML with multiple results', async () => {
      const mockFetch = createMockFetch({
        '/services/async/65.0/job/750Kf00000R1wzRIAR/batch/751Kf000018uaV7IAI/result':
          BULK_XML_RESPONSES.RESULT_LIST_MULTIPLE,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const result = await apiBulk.getQueryResultsJobIds('750Kf00000R1wzRIAR', '751Kf000018uaV7IAI');

      // Multiple results should be an array
      expect(result.length).toBe(3);
      expect(result[0]).toBe('752Kf000018uaV9IAI');
      expect(result[1]).toBe('752Kf000018uaVAIAI');
      expect(result[2]).toBe('752Kf000018uaVBIAI');
    });
  });

  describe('XML namespace and attribute handling', () => {
    it('should handle and remove XML namespace attributes after parsing', async () => {
      // The XML responses include xmlns="http://www.force.com/2009/06/asyncapi/dataload"
      // bulkApiEnsureTyped should remove @xmlns attributes
      const mockFetch = createMockFetch({
        '/services/async/65.0/job': BULK_XML_RESPONSES.JOB_INFO_OPEN,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const payload: BulkApiCreateJobRequestPayload = {
        type: 'UPDATE',
        sObject: 'Account',
      };

      const result = await apiBulk.createJob(payload);

      // Namespace attributes should be cleaned up
      expect(result['@xmlns']).toBeUndefined();
      expect(result.id).toBe('750Kf00000R1wzRIAR');
    });
  });

  describe('XML parsing edge cases', () => {
    it('should handle XML with various numeric formats', async () => {
      // Test that various numeric string formats get converted correctly
      const mockFetch = createMockFetch({
        '/services/async/65.0/job': BULK_XML_RESPONSES.JOB_INFO_CLOSED,
      });

      const connection = createConnectionWithXmlParsing(mockFetch);
      const apiBulk = new ApiBulk(connection);

      const payload: BulkApiCreateJobRequestPayload = {
        type: 'UPDATE',
        sObject: 'Account',
      };

      const result = await apiBulk.createJob(payload);

      // Verify all numeric fields are properly converted
      const numericFields = [
        'numberBatchesQueued',
        'numberBatchesInProgress',
        'numberBatchesCompleted',
        'numberBatchesFailed',
        'numberBatchesTotal',
        'numberRecordsProcessed',
        'numberRetries',
        'apiVersion',
        'numberRecordsFailed',
        'totalProcessingTime',
        'apiActiveProcessingTime',
        'apexProcessingTime',
      ];

      numericFields.forEach((field) => {
        expect(typeof result[field]).toBe('number');
        expect(Number.isNaN(result[field])).toBe(false);
      });
    });
  });
});
