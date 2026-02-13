import { describe, expect, it, vi } from 'vitest';
import { ApiRequestError, getApiRequestFactoryFn } from '../callout-adapter';
import type { FetchFn } from '../types';

// Mock XML responses from Salesforce
const MOCK_RESPONSES = {
  SOAP_DESCRIBE_METADATA: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><describeMetadataResponse><result><metadataObjects><directoryName>installedPackages</directoryName><inFolder>false</inFolder><metaFile>false</metaFile><suffix>installedPackage</suffix><xmlName>InstalledPackage</xmlName></metadataObjects><metadataObjects><childXmlNames>CustomLabel</childXmlNames><directoryName>labels</directoryName><inFolder>false</inFolder><metaFile>false</metaFile><suffix>labels</suffix><xmlName>CustomLabels</xmlName></metadataObjects><organizationNamespace></organizationNamespace><partialSaveAllowed>true</partialSaveAllowed><testRequired>false</testRequired></result></describeMetadataResponse></soapenv:Body></soapenv:Envelope>`,

  SOAP_EMPTY_LIST_METADATA: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><listMetadataResponse/></soapenv:Body></soapenv:Envelope>`,

  SOAP_LIST_METADATA_WITH_RESULTS: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope
	xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
	xmlns="http://soap.sforce.com/2006/04/metadata">
	<soapenv:Body>
		<listMetadataResponse>
			<result>
				<createdById>0056g000004tCpaAAE</createdById>
				<createdByName>Austin Turner</createdByName>
				<createdDate>2021-10-01T02:46:23.000Z</createdDate>
				<fileName>classes/SBQQ__FieldDescriptorTests.cls</fileName>
				<fullName>SBQQ__FieldDescriptorTests</fullName>
				<id>01p6g00000RGbskAAD</id>
				<lastModifiedById>0056g000004tCpaAAE</lastModifiedById>
				<lastModifiedByName>Austin Turner</lastModifiedByName>
				<lastModifiedDate>2021-10-01T02:46:23.000Z</lastModifiedDate>
				<manageableState>installed</manageableState>
				<namespacePrefix>SBQQ</namespacePrefix>
				<type>ApexClass</type>
			</result>
			<result>
				<createdById>0056g000004tCpaAAE</createdById>
				<createdByName>Austin Turner</createdByName>
				<createdDate>2022-03-02T02:52:39.000Z</createdDate>
				<fileName>classes/ProjectCalloutServiceMockFailure.cls</fileName>
				<fullName>ProjectCalloutServiceMockFailure</fullName>
				<id>01p6g00000SlXzQAAV</id>
				<lastModifiedById>0056g000004tCpaAAE</lastModifiedById>
				<lastModifiedByName>Austin Turner</lastModifiedByName>
				<lastModifiedDate>2022-03-02T02:52:39.000Z</lastModifiedDate>
				<manageableState>unmanaged</manageableState>
				<type>ApexClass</type>
			</result>
		</listMetadataResponse>
	</soapenv:Body>
</soapenv:Envelope>`,

  SOAP_RETRIEVE_RESPONSE: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><retrieveResponse><result><done>false</done><id>09SKf000002knYIMAY</id><state>Queued</state></result></retrieveResponse></soapenv:Body></soapenv:Envelope>`,

  SOAP_CHECK_RETRIEVE_STATUS: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata"><soapenv:Body><checkRetrieveStatusResponse><result><done>true</done><fileProperties><createdById>0056g000004tCpaAAE</createdById><createdByName>Austin Turner</createdByName><createdDate>2021-02-01T03:16:19.000Z</createdDate><fileName>classes/AddPrimaryContactTest.cls</fileName><fullName>AddPrimaryContactTest</fullName><id>01p6g00000RikTBAAZ</id><lastModifiedById>0056g000004tCpaAAE</lastModifiedById><lastModifiedByName>Austin Turner</lastModifiedByName><lastModifiedDate>2022-03-02T02:52:38.000Z</lastModifiedDate><manageableState>unmanaged</manageableState><type>ApexClass</type></fileProperties><id>09SKf000002knYIMAY</id><status>Succeeded</status><success>true</success><zipFile>UEsDBBQACAgIAJl8TFwAAAA=</zipFile></result></checkRetrieveStatusResponse></soapenv:Body></soapenv:Envelope>`,

  SOAP_EXECUTE_ANONYMOUS: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/08/apex" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Header><DebuggingInfo><debugLog>65.0 APEX_CODE,FINEST
Execute Anonymous: System.debug(&apos;test&apos;);
07:37:50.55 (56900211)|USER_DEBUG|[1]|DEBUG|test
</debugLog></DebuggingInfo></soapenv:Header><soapenv:Body><executeAnonymousResponse><result><column>-1</column><compileProblem xsi:nil="true"/><compiled>true</compiled><exceptionMessage xsi:nil="true"/><exceptionStackTrace xsi:nil="true"/><line>-1</line><success>true</success></result></executeAnonymousResponse></soapenv:Body></soapenv:Envelope>`,

  XML_SOBJECT_DESCRIBE: `<?xml version="1.0" encoding="UTF-8"?>
<Account xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
    <objectDescribe>
        <activateable>false</activateable>
        <associateEntityType xsi:nil="true"/>
        <associateParentEntity xsi:nil="true"/>
        <createable>true</createable>
        <custom>false</custom>
        <customSetting>false</customSetting>
        <keyPrefix>001</keyPrefix>
        <label>Account</label>
        <labelPlural>Accounts</labelPlural>
        <name>Account</name>
        <queryable>true</queryable>
    </objectDescribe>
    <recentItems type="Account" url="/services/data/v65.0/sobjects/Account/001Kf00001FGIvKIAX">
        <Id>001Kf00001FGIvKIAX</Id>
        <Name>dsfds</Name>
    </recentItems>
    <recentItems type="Account" url="/services/data/v65.0/sobjects/Account/001Kf00001FGGCiIAP">
        <Id>001Kf00001FGGCiIAP</Id>
        <Name>test</Name>
    </recentItems>
</Account>`,

  SOAP_ERROR_INVALID_SESSION: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sf="http://soap.sforce.com/2006/04/metadata" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><soapenv:Body><soapenv:Fault><faultcode>sf:INVALID_SESSION_ID</faultcode><faultstring>INVALID_SESSION_ID: Invalid Session ID found in SessionHeader: Illegal Session</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`,

  SOAP_ERROR_GENERIC: `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><soapenv:Fault><faultcode>soapenv:Client</faultcode><faultstring>Invalid request data</faultstring></soapenv:Fault></soapenv:Body></soapenv:Envelope>`,

  BULK_XML_ERROR: `<?xml version="1.0" encoding="UTF-8"?><error xmlns="http://www.force.com/2009/06/asyncapi/dataload"><exceptionCode>InvalidBatch</exceptionCode><exceptionMessage>Records not found for this batch</exceptionMessage></error>`,

  BULK_JOB_INFO_OPEN: `<?xml version="1.0" encoding="UTF-8"?><jobInfo
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

  BULK_BATCH_INFO: `<?xml version="1.0" encoding="UTF-8"?><batchInfo
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

  BULK_JOB_INFO_CLOSED: `<?xml version="1.0" encoding="UTF-8"?><jobInfo
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

  BULK_BATCH_INFO_LIST: `<?xml version="1.0" encoding="UTF-8"?><batchInfoList
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
};

describe('callout-adapter XML parsing', () => {
  const mockSessionInfo = {
    accessToken: 'test-token',
    instanceUrl: 'https://test.salesforce.com',
    apiVersion: '65.0',
    userId: 'test-user-id',
    organizationId: 'test-org-id',
  };

  // Helper to find a key that contains a specific string (handles namespace variations)
  const findKey = (obj: any, search: string): string | undefined => {
    return Object.keys(obj).find((k) => k.includes(search));
  };

  // Helper to navigate SOAP envelope structure (handles different namespace prefixes)
  const getSoapBody = (result: any): any => {
    const envelopeKey = findKey(result, 'Envelope');
    if (!envelopeKey) throw new Error('No Envelope found in result');
    const envelope = result[envelopeKey];
    const bodyKey = findKey(envelope, 'Body');
    if (!bodyKey) throw new Error('No Body found in envelope');
    return envelope[bodyKey];
  };

  // Helper to get SOAP header
  const getSoapHeader = (result: any): any => {
    const envelopeKey = findKey(result, 'Envelope');
    if (!envelopeKey) throw new Error('No Envelope found in result');
    const envelope = result[envelopeKey];
    const headerKey = findKey(envelope, 'Header');
    if (!headerKey) throw new Error('No Header found in envelope');
    return envelope[headerKey];
  };

  // Helper to create a mock fetch function
  const createMockFetch = (responses: Record<string, { status: number; body: string; headers?: Record<string, string> }>): FetchFn => {
    return vi.fn((url: string | URL, options?: RequestInit) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      const matchedKey = Object.keys(responses).find((key) => urlStr.includes(key));

      if (!matchedKey) {
        throw new Error(`No mock response for URL: ${urlStr}`);
      }

      const mockResponse = responses[matchedKey];
      const headers = new Headers({
        'content-type': 'text/xml; charset=UTF-8',
        ...mockResponse.headers,
      });

      return Promise.resolve({
        ok: mockResponse.status >= 200 && mockResponse.status < 300,
        status: mockResponse.status,
        statusText: mockResponse.status === 200 ? 'OK' : 'Error',
        headers,
        type: 'basic' as ResponseType,
        url: urlStr,
        text: () => Promise.resolve(mockResponse.body),
        json: () => Promise.reject(new Error('Not JSON')),
        clone() {
          return this;
        },
      } as any);
    }) as FetchFn;
  };

  describe('SOAP XML parsing (outputType: soap)', () => {
    it('should parse describeMetadata SOAP response', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_DESCRIBE_METADATA },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const body = getSoapBody(result);
      expect(body).toHaveProperty('describeMetadataResponse');
      expect(body.describeMetadataResponse).toHaveProperty('result');
      expect(body.describeMetadataResponse.result).toHaveProperty('metadataObjects');
    });

    it('should parse empty listMetadata SOAP response', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_EMPTY_LIST_METADATA },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const body = getSoapBody(result);
      expect(body).toHaveProperty('listMetadataResponse');
    });

    it('should parse listMetadata SOAP response with multiple results', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_LIST_METADATA_WITH_RESULTS },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const body = getSoapBody(result);
      const response = body.listMetadataResponse;
      expect(response).toHaveProperty('result');

      // Should have multiple results - parser may return array or single object
      const results = Array.isArray(response.result) ? response.result : [response.result];
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('fullName');
      expect(results[0]).toHaveProperty('fileName');
      expect(results[0]).toHaveProperty('type');
    });

    it('should parse retrieve SOAP response', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_RETRIEVE_RESPONSE },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const body = getSoapBody(result);
      const response = body.retrieveResponse;
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('done');
      expect(response.result).toHaveProperty('id');
      expect(response.result).toHaveProperty('state');
    });

    it('should parse checkRetrieveStatus SOAP response with zipFile', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_CHECK_RETRIEVE_STATUS },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const body = getSoapBody(result);
      const response = body.checkRetrieveStatusResponse;
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('done');
      expect(response.result).toHaveProperty('fileProperties');
      expect(response.result).toHaveProperty('zipFile');
      expect(response.result.zipFile).toBeTruthy();
    });

    it('should parse executeAnonymous SOAP response with header', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/s/': { status: 200, body: MOCK_RESPONSES.SOAP_EXECUTE_ANONYMOUS },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/s/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const header = getSoapHeader(result);
      expect(header).toHaveProperty('DebuggingInfo');
      expect(header.DebuggingInfo).toHaveProperty('debugLog');

      const body = getSoapBody(result);
      const response = body.executeAnonymousResponse;
      expect(response).toHaveProperty('result');
      expect(response.result).toHaveProperty('compiled');
      expect(response.result).toHaveProperty('success');
    });
  });

  describe('XML parsing (outputType: xml)', () => {
    it('should parse sObject describe XML response', async () => {
      const mockFetch = createMockFetch({
        '/services/data/': { status: 200, body: MOCK_RESPONSES.XML_SOBJECT_DESCRIBE },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/data/v65.0/sobjects/Account/describe',
        method: 'GET',
        sessionInfo: mockSessionInfo,
        outputType: 'xml',
      });

      expect(result).toBeDefined();
      const account = result as any;
      expect(account).toHaveProperty('Account');
      expect(account.Account).toHaveProperty('objectDescribe');
      expect(account.Account.objectDescribe).toHaveProperty('label');
      expect(account.Account.objectDescribe.label).toBe('Account');
      expect(account.Account).toHaveProperty('recentItems');

      // Check recent items
      const recentItems = Array.isArray(account.Account.recentItems) ? account.Account.recentItems : [account.Account.recentItems];
      expect(recentItems.length).toBeGreaterThan(0);
      expect(recentItems[0]).toHaveProperty('Id');
      expect(recentItems[0]).toHaveProperty('Name');
    });

    it('should parse Bulk API jobInfo (open state)', async () => {
      const mockFetch = createMockFetch({
        '/services/async/': { status: 200, body: MOCK_RESPONSES.BULK_JOB_INFO_OPEN },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/async/65.0/job',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'xml',
      });

      expect(result).toBeDefined();
      const data = result as any;
      expect(data).toHaveProperty('jobInfo');
      expect(data.jobInfo).toHaveProperty('id');
      expect(data.jobInfo).toHaveProperty('operation');
      expect(data.jobInfo).toHaveProperty('object');
      expect(data.jobInfo).toHaveProperty('state');
      expect(data.jobInfo.state).toBe('Open');
      expect(data.jobInfo).toHaveProperty('numberBatchesTotal');
      expect(data.jobInfo).toHaveProperty('numberRecordsProcessed');
    });

    it('should parse Bulk API jobInfo (closed state)', async () => {
      const mockFetch = createMockFetch({
        '/services/async/': { status: 200, body: MOCK_RESPONSES.BULK_JOB_INFO_CLOSED },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/async/65.0/job/750Kf00000R1wzRIAR',
        method: 'GET',
        sessionInfo: mockSessionInfo,
        outputType: 'xml',
      });

      expect(result).toBeDefined();
      const data = result as any;
      expect(data).toHaveProperty('jobInfo');
      expect(data.jobInfo.state).toBe('Closed');
      expect(data.jobInfo.numberBatchesCompleted).toBe(1);
      expect(data.jobInfo.numberRecordsProcessed).toBe(251);
      expect(data.jobInfo.numberRecordsFailed).toBe(251);
    });

    it('should parse Bulk API batchInfo', async () => {
      const mockFetch = createMockFetch({
        '/services/async/': { status: 200, body: MOCK_RESPONSES.BULK_BATCH_INFO },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/async/65.0/job/750Kf00000R1wzRIAR/batch',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'xml',
      });

      expect(result).toBeDefined();
      const data = result as any;
      expect(data).toHaveProperty('batchInfo');
      expect(data.batchInfo).toHaveProperty('id');
      expect(data.batchInfo).toHaveProperty('jobId');
      expect(data.batchInfo).toHaveProperty('state');
      expect(data.batchInfo.state).toBe('Queued');
      expect(data.batchInfo).toHaveProperty('numberRecordsProcessed');
      expect(data.batchInfo).toHaveProperty('numberRecordsFailed');
    });

    it('should parse Bulk API batchInfoList', async () => {
      const mockFetch = createMockFetch({
        '/services/async/': { status: 200, body: MOCK_RESPONSES.BULK_BATCH_INFO_LIST },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/async/65.0/job/750Kf00000R1wzRIAR/batch',
        method: 'GET',
        sessionInfo: mockSessionInfo,
        outputType: 'xml',
      });

      expect(result).toBeDefined();
      const data = result as any;
      expect(data).toHaveProperty('batchInfoList');
      expect(data.batchInfoList).toHaveProperty('batchInfo');

      // batchInfo may be array or single object depending on parser
      const batchInfos = Array.isArray(data.batchInfoList.batchInfo) ? data.batchInfoList.batchInfo : [data.batchInfoList.batchInfo];

      expect(batchInfos.length).toBeGreaterThan(0);
      expect(batchInfos[0]).toHaveProperty('id');
      expect(batchInfos[0]).toHaveProperty('jobId');
      expect(batchInfos[0]).toHaveProperty('state');
      expect(batchInfos[0].state).toBe('Completed');
    });
  });

  describe('SOAP error parsing', () => {
    it('should extract error message from SOAP fault response', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 500, body: MOCK_RESPONSES.SOAP_ERROR_GENERIC },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();

      await expect(async () => {
        await apiRequest({
          url: '/services/Soap/m/65.0',
          method: 'POST',
          sessionInfo: mockSessionInfo,
          outputType: 'soap',
        });
      }).rejects.toThrow(ApiRequestError);

      try {
        await apiRequest({
          url: '/services/Soap/m/65.0',
          method: 'POST',
          sessionInfo: mockSessionInfo,
          outputType: 'soap',
        });
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        expect((error as ApiRequestError).message).toBe('Invalid request data');
      }
    });

    it('should extract error message from INVALID_SESSION_ID SOAP fault', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 500, body: MOCK_RESPONSES.SOAP_ERROR_INVALID_SESSION },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();

      try {
        await apiRequest({
          url: '/services/Soap/m/65.0',
          method: 'POST',
          sessionInfo: mockSessionInfo,
          outputType: 'soap',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        expect((error as ApiRequestError).message).toContain('INVALID_SESSION_ID');
      }
    });
  });

  describe('Bulk XML error parsing', () => {
    it('should extract error message from Bulk API XML error', async () => {
      const mockFetch = createMockFetch({
        '/services/async/': { status: 400, body: MOCK_RESPONSES.BULK_XML_ERROR },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();

      try {
        await apiRequest({
          url: '/services/async/65.0/job/123/batch/456',
          method: 'GET',
          sessionInfo: mockSessionInfo,
          outputType: 'xml',
        });
        // Should not reach here
        expect(true).toBe(false);
      } catch (error) {
        expect(error).toBeInstanceOf(ApiRequestError);
        expect((error as ApiRequestError).message).toBe('Records not found for this batch');
      }
    });
  });

  describe('Edge cases and special characters', () => {
    it('should handle XML with attributes on elements', async () => {
      const mockFetch = createMockFetch({
        '/services/data/': { status: 200, body: MOCK_RESPONSES.XML_SOBJECT_DESCRIBE },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/data/v65.0/sobjects/Account/describe',
        method: 'GET',
        sessionInfo: mockSessionInfo,
        outputType: 'xml',
      });

      const account = result as any;
      const recentItems = Array.isArray(account.Account.recentItems) ? account.Account.recentItems : [account.Account.recentItems];

      // Check that attributes are preserved (different parsers may use @attr or just attr)
      const firstItem = recentItems[0];
      const hasTypeAttr = firstItem['@_type'] || firstItem.type;
      expect(hasTypeAttr).toBeTruthy();
      // If attributes are preserved with @, check they match expected values
      if (firstItem['@_type']) {
        expect(firstItem['@_type']).toBe('Account');
      }
    });

    it('should handle empty elements', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_EMPTY_LIST_METADATA },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      const body = getSoapBody(result);
      expect(body.listMetadataResponse).toBeDefined();
    });

    it('should handle xsi:nil attributes', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/s/': { status: 200, body: MOCK_RESPONSES.SOAP_EXECUTE_ANONYMOUS },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/s/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      const body = getSoapBody(result);
      const resultData = body.executeAnonymousResponse.result;

      // Elements with xsi:nil="true" should be present (may be null/undefined or have @_nil attribute)
      expect(resultData).toHaveProperty('compileProblem');
      expect(resultData).toHaveProperty('exceptionMessage');
      expect(resultData).toHaveProperty('exceptionStackTrace');
    });
  });

  describe('Namespace handling', () => {
    it('should preserve or normalize namespace prefixes in SOAP responses', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_DESCRIBE_METADATA },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      expect(result).toBeDefined();
      // Check that some form of Envelope exists (namespace prefix may vary)
      const envelopeKey = findKey(result as any, 'Envelope');
      expect(envelopeKey).toBeDefined();
    });

    it('should handle default namespace in XML responses', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/': { status: 200, body: MOCK_RESPONSES.SOAP_LIST_METADATA_WITH_RESULTS },
      });

      const apiRequest = getApiRequestFactoryFn(mockFetch)();
      const result = await apiRequest({
        url: '/services/Soap/m/65.0',
        method: 'POST',
        sessionInfo: mockSessionInfo,
        outputType: 'soap',
      });

      const body = getSoapBody(result);
      const response = body.listMetadataResponse;

      // Elements without namespace prefix should still be accessible
      expect(response.result).toBeDefined();
      const results = Array.isArray(response.result) ? response.result : [response.result];
      expect(results[0]).toHaveProperty('createdById');
      expect(results[0]).toHaveProperty('fullName');
    });
  });
});
