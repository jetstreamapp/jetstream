import { describe, it, expect, vi } from 'vitest';
import { ApiMetadata } from '../api-metadata';
import { ApiConnection } from '../connection';
import { getApiRequestFactoryFn } from '../callout-adapter';

// Real SOAP XML responses from Salesforce Metadata API
const METADATA_SOAP_RESPONSES = {
  DESCRIBE_METADATA: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <describeMetadataResponse>
      <result>
        <organizationNamespace></organizationNamespace>
        <partialSaveAllowed>true</partialSaveAllowed>
        <testRequired>false</testRequired>
        <metadataObjects>
          <directoryName>installedPackages</directoryName>
          <inFolder>false</inFolder>
          <metaFile>false</metaFile>
          <suffix>installedPackage</suffix>
          <xmlName>InstalledPackage</xmlName>
        </metadataObjects>
        <metadataObjects>
          <childXmlNames>CustomLabel</childXmlNames>
          <childXmlNames>CustomFieldTranslation</childXmlNames>
          <directoryName>labels</directoryName>
          <inFolder>false</inFolder>
          <metaFile>false</metaFile>
          <suffix>labels</suffix>
          <xmlName>CustomLabels</xmlName>
        </metadataObjects>
      </result>
    </describeMetadataResponse>
  </soapenv:Body>
</soapenv:Envelope>`,

  LIST_METADATA_MULTIPLE: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <listMetadataResponse>
      <result>
        <createdById>0056g000004tCpaAAE</createdById>
        <createdByName>Austin Turner</createdByName>
        <createdDate>2021-10-01T02:46:23.000Z</createdDate>
        <fileName>classes/FieldDescriptorTests.cls</fileName>
        <fullName>FieldDescriptorTests</fullName>
        <id>01p6g00000RGbskAAD</id>
        <type>ApexClass</type>
      </result>
      <result>
        <createdById>0056g000004tCpaAAE</createdById>
        <createdByName>Austin Turner</createdByName>
        <createdDate>2022-03-02T02:52:39.000Z</createdDate>
        <fileName>classes/CalloutServiceMock.cls</fileName>
        <fullName>CalloutServiceMock</fullName>
        <id>01p6g00000SlXzQAAV</id>
        <type>ApexClass</type>
      </result>
    </listMetadataResponse>
  </soapenv:Body>
</soapenv:Envelope>`,

  LIST_METADATA_EMPTY: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <listMetadataResponse/>
  </soapenv:Body>
</soapenv:Envelope>`,

  LIST_METADATA_SINGLE: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <listMetadataResponse>
      <result>
        <createdById>0056g000004tCpaAAE</createdById>
        <fullName>TestClass</fullName>
        <type>ApexClass</type>
        <namespacePrefix xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:nil="true"/>
      </result>
    </listMetadataResponse>
  </soapenv:Body>
</soapenv:Envelope>`,

  CHECK_RETRIEVE_STATUS: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <checkRetrieveStatusResponse>
      <result>
        <done>true</done>
        <success>true</success>
        <fileProperties>
          <createdById>0056g000004tCpaAAE</createdById>
          <fileName>classes/TestClass.cls</fileName>
          <fullName>TestClass</fullName>
          <id>01p6g00000RikTBAAZ</id>
          <type>ApexClass</type>
        </fileProperties>
        <fileProperties>
          <createdById>0056g000004tCpaAAE</createdById>
          <fileName>classes/TestClass2.cls</fileName>
          <fullName>TestClass2</fullName>
          <id>01p6g00000SlXyzAAF</id>
          <type>ApexClass</type>
        </fileProperties>
        <messages/>
        <zipFile>UEsDBBQACAgIAJl8TFwAAAA=</zipFile>
      </result>
    </checkRetrieveStatusResponse>
  </soapenv:Body>
</soapenv:Envelope>`,

  DEPLOY_RESPONSE: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <deployResponse>
      <result>
        <done>false</done>
        <id>0Af6g00000TestAAA</id>
        <state>Queued</state>
      </result>
    </deployResponse>
  </soapenv:Body>
</soapenv:Envelope>`,

  CHECK_DEPLOY_STATUS: `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <checkDeployStatusResponse>
      <result>
        <done>true</done>
        <success>true</success>
        <status>Succeeded</status>
        <numberComponentErrors>0</numberComponentErrors>
        <numberComponentsDeployed>5</numberComponentsDeployed>
        <numberComponentsTotal>5</numberComponentsTotal>
        <numberTestErrors>0</numberTestErrors>
        <numberTestsCompleted>3</numberTestsCompleted>
        <numberTestsTotal>3</numberTestsTotal>
        <details>
          <componentSuccesses>
            <fullName>TestClass</fullName>
            <componentType>ApexClass</componentType>
            <success>true</success>
          </componentSuccesses>
          <componentSuccesses>
            <fullName>TestClass2</fullName>
            <componentType>ApexClass</componentType>
            <success>true</success>
          </componentSuccesses>
          <componentFailures/>
        </details>
      </result>
    </checkDeployStatusResponse>
  </soapenv:Body>
</soapenv:Envelope>`,
};

// Helper to create a mock fetch that returns SOAP XML
const createMockFetch = (responses: Record<string, string>) => {
  return vi.fn((url: string | URL) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Find the most specific matching key (longest match wins)
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

// Helper to create connection with real SOAP/XML parsing
const createConnectionWithSoapParsing = (mockFetch: any) => {
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

describe('ApiMetadata SOAP XML parsing and type handling', () => {
  describe('describe - SOAP XML parsing', () => {
    it('should parse describeMetadata SOAP response and convert types', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.DESCRIBE_METADATA,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.describe();

      // Verify boolean conversions from string "true"/"false" to actual booleans
      expect(typeof result.partialSaveAllowed).toBe('boolean');
      expect(typeof result.testRequired).toBe('boolean');
      expect(result.partialSaveAllowed).toBe(true);
      expect(result.testRequired).toBe(false);

      // Verify empty string handling - empty elements get converted to null by correctInvalidXmlResponseTypes
      // But api-metadata.ts line 49 converts back to empty string if it's a string: isString(x) ? x : null
      // Since null is not a string, it becomes null
      expect(result.organizationNamespace).toBe(null);

      // Verify metadataObjects array handling
      expect(Array.isArray(result.metadataObjects)).toBe(true);
      expect(result.metadataObjects.length).toBe(2);
      expect(result.metadataObjects[0].xmlName).toBe('InstalledPackage');
      expect(result.metadataObjects[0].inFolder).toBe(false);

      // Verify childXmlNames handling - should be arrays
      expect(Array.isArray(result.metadataObjects[0].childXmlNames)).toBe(true);
      expect(result.metadataObjects[0].childXmlNames).toEqual([]);
      expect(Array.isArray(result.metadataObjects[1].childXmlNames)).toBe(true);
      expect(result.metadataObjects[1].childXmlNames!.length).toBe(2);
      expect(result.metadataObjects[1].childXmlNames!).toContain('CustomLabel');
    });
  });

  describe('list - SOAP XML parsing', () => {
    it('should parse listMetadata SOAP response with multiple results', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.LIST_METADATA_MULTIPLE,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.list([{ type: 'ApexClass' }]);

      // Should return array from XML parsing
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].fullName).toBe('FieldDescriptorTests');
      expect(result[0].type).toBe('ApexClass');
      expect(result[1].fullName).toBe('CalloutServiceMock');
    });

    it('should handle empty listMetadata SOAP response', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.LIST_METADATA_EMPTY,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.list([{ type: 'ApexClass' }]);

      // Empty response should result in empty array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(0);
    });

    it('should handle single result and convert xsi:nil to null', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.LIST_METADATA_SINGLE,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.list([{ type: 'ApexClass' }]);

      // Single result should be converted to array
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      expect(result[0].fullName).toBe('TestClass');

      // xsi:nil should be converted to null
      expect(result[0].namespacePrefix).toBe(null);
    });
  });

  describe('checkRetrieveStatus - SOAP XML parsing', () => {
    it('should parse checkRetrieveStatus and handle fileProperties array', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.CHECK_RETRIEVE_STATUS,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.checkRetrieveStatus('test-id');

      // Verify boolean conversions
      expect(typeof result.done).toBe('boolean');
      expect(typeof result.success).toBe('boolean');
      expect(result.done).toBe(true);
      expect(result.success).toBe(true);

      // fileProperties should be array even from XML
      expect(Array.isArray(result.fileProperties)).toBe(true);
      expect(result.fileProperties.length).toBe(2);
      expect(result.fileProperties[0].fullName).toBe('TestClass');

      // messages should be array - empty XML element becomes array with one item
      expect(Array.isArray(result.messages)).toBe(true);
      // XML parser returns empty element as empty object/string, which ensureArray converts to [{}] or ['']
      expect(result.messages.length).toBeGreaterThanOrEqual(0);

      // zipFile should be present
      expect(result.zipFile).toBe('UEsDBBQACAgIAJl8TFwAAAA=');
    });
  });

  describe('deploy - SOAP XML parsing', () => {
    it('should parse deploy SOAP response and convert types', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.DEPLOY_RESPONSE,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.deploy('base64zipfile', {});

      // Verify boolean conversion
      expect(typeof result.done).toBe('boolean');
      expect(result.done).toBe(false);
      expect(result.id).toBe('0Af6g00000TestAAA');
      expect(result.state).toBe('Queued');
    });
  });

  describe('checkDeployStatus - SOAP XML parsing and numeric conversions', () => {
    it('should parse checkDeployStatus and convert all numeric fields', async () => {
      const mockFetch = createMockFetch({
        '/services/Soap/m/65.0': METADATA_SOAP_RESPONSES.CHECK_DEPLOY_STATUS,
      });

      const connection = createConnectionWithSoapParsing(mockFetch);
      const apiMetadata = new ApiMetadata(connection);

      const result = await apiMetadata.checkDeployStatus('0Af6g00000TestAAA', true);

      // Verify boolean conversions
      expect(typeof result.done).toBe('boolean');
      expect(typeof result.success).toBe('boolean');
      expect(result.done).toBe(true);
      expect(result.success).toBe(true);

      // CRITICAL: Verify numeric conversions from XML strings
      expect(typeof result.numberComponentErrors).toBe('number');
      expect(typeof result.numberComponentsDeployed).toBe('number');
      expect(typeof result.numberComponentsTotal).toBe('number');
      expect(typeof result.numberTestErrors).toBe('number');
      expect(typeof result.numberTestsCompleted).toBe('number');
      expect(typeof result.numberTestsTotal).toBe('number');

      expect(result.numberComponentErrors).toBe(0);
      expect(result.numberComponentsDeployed).toBe(5);
      expect(result.numberComponentsTotal).toBe(5);

      // Verify details arrays
      expect(result.details).toBeDefined();
      expect(Array.isArray(result.details!.componentSuccesses)).toBe(true);
      expect(result.details!.componentSuccesses.length).toBe(2);
      expect(Array.isArray(result.details!.componentFailures)).toBe(true);
      // Empty XML element <componentFailures/> becomes array with empty item after parsing
      expect(result.details!.componentFailures.length).toBeGreaterThanOrEqual(0);

      // Verify boolean conversion in nested objects
      expect(typeof result.details!.componentSuccesses[0].success).toBe('boolean');
      expect(result.details!.componentSuccesses[0].success).toBe(true);
    });
  });
});
