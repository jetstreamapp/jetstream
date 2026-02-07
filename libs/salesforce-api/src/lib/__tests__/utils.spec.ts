import { vi } from 'vitest';
import { ApiConnection } from '../connection';
import {
  SalesforceApi,
  correctInvalidArrayXmlResponseTypes,
  correctInvalidXmlResponseTypes,
  getBinaryFileRecordQueryMap,
  prepareBulkApiRequestPayload,
  prepareCloseOrAbortJobPayload,
  toSoapXML,
} from '../utils';

describe('getRestApiUrl', () => {
  const apiConnection = new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: vi.fn(),
    apiVersion: '50.0',
    instanceUrl: 'https://test.salesforce.com',
    organizationId: 'test',
    userId: 'test',
    callOptions: {},
    logging: false,
    refreshToken: 'test',
  });
  const sfdcApi = new SalesforceApi(apiConnection);
  it('should return correct URL for non-tooling case', () => {
    const url = sfdcApi.getRestApiUrl('/myPath', false);
    expect(url).toBe('/services/data/v50.0/myPath'); // replace 50.0 with the actual apiVersion
  });

  it('should return correct URL for tooling case', () => {
    const url = sfdcApi.getRestApiUrl('/myPath', true);
    expect(url).toBe('/services/data/v50.0/tooling/myPath'); // replace 50.0 with the actual apiVersion
  });
});

it('should convert object to SOAP XML', () => {
  const obj = {
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    escapedWord: `&<"te'st">&`,
    favoriteFoods: ['pizza', 'chocolate'],
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
  };

  const expectedXML =
    '<firstName>John</firstName><lastName>Doe</lastName><age>30</age><escapedWord>&amp;&lt;&quot;te&apos;st&quot;&gt;&amp;</escapedWord><favoriteFoods>pizza</favoriteFoods><favoriteFoods>chocolate</favoriteFoods><address><street>123 Main St</street><city>New York</city><state>NY</state><country>USA</country></address>';

  const result = toSoapXML(obj);

  expect(result).toBe(expectedXML);
});

describe('getRestApiUrl', () => {
  const apiConnection = new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: vi.fn(),
    apiVersion: '50.0',
    instanceUrl: 'https://test.salesforce.com',
    organizationId: 'test',
    userId: 'test',
    callOptions: {},
    logging: false,
    refreshToken: 'test',
  });
  const sfdcApi = new SalesforceApi(apiConnection);
  it('should return correct URL for non-tooling case', () => {
    const url = sfdcApi.getRestApiUrl('/myPath', false);
    expect(url).toBe('/services/data/v50.0/myPath'); // replace 50.0 with the actual apiVersion
  });

  it('should return correct URL for tooling case', () => {
    const url = sfdcApi.getRestApiUrl('/myPath', true);
    expect(url).toBe('/services/data/v50.0/tooling/myPath'); // replace 50.0 with the actual apiVersion
  });
});

it('should convert object to SOAP XML', () => {
  const obj = {
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    escapedWord: `&<"te'st">&`,
    favoriteFoods: ['pizza', 'chocolate'],
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
  };

  const expectedXML =
    '<firstName>John</firstName><lastName>Doe</lastName><age>30</age><escapedWord>&amp;&lt;&quot;te&apos;st&quot;&gt;&amp;</escapedWord><favoriteFoods>pizza</favoriteFoods><favoriteFoods>chocolate</favoriteFoods><address><street>123 Main St</street><city>New York</city><state>NY</state><country>USA</country></address>';

  const result = toSoapXML(obj);

  expect(result).toBe(expectedXML);
});

describe('correctInvalidArrayXmlResponseTypes', () => {
  it('should return an empty array for null response', () => {
    const result = correctInvalidArrayXmlResponseTypes(null);
    expect(result).toEqual([]);
  });

  it('should convert a single item to an array', () => {
    const item = { name: 'John Doe', age: 30 };
    const result = correctInvalidArrayXmlResponseTypes(item);
    expect(result).toEqual([item]);
  });

  it('should not modify an array', () => {
    const items = [
      { name: 'John Doe', age: 30 },
      { name: 'Jane Smith', age: 25 },
    ];
    const result = correctInvalidArrayXmlResponseTypes(items);
    expect(result).toEqual(items);
  });
});

describe('getRestApiUrl', () => {
  const apiConnection = new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: vi.fn(),
    apiVersion: '50.0',
    instanceUrl: 'https://test.salesforce.com',
    organizationId: 'test',
    userId: 'test',
    callOptions: {},
    logging: false,
    refreshToken: 'test',
  });
  const sfdcApi = new SalesforceApi(apiConnection);
  it('should return correct URL for non-tooling case', () => {
    const url = sfdcApi.getRestApiUrl('/myPath', false);
    expect(url).toBe('/services/data/v50.0/myPath'); // replace 50.0 with the actual apiVersion
  });

  it('should return correct URL for tooling case', () => {
    const url = sfdcApi.getRestApiUrl('/myPath', true);
    expect(url).toBe('/services/data/v50.0/tooling/myPath'); // replace 50.0 with the actual apiVersion
  });
});

it('should convert object to SOAP XML', () => {
  const obj = {
    firstName: 'John',
    lastName: 'Doe',
    age: 30,
    escapedWord: `&<"te'st">&`,
    favoriteFoods: ['pizza', 'chocolate'],
    address: {
      street: '123 Main St',
      city: 'New York',
      state: 'NY',
      country: 'USA',
    },
  };

  const expectedXML =
    '<firstName>John</firstName><lastName>Doe</lastName><age>30</age><escapedWord>&amp;&lt;&quot;te&apos;st&quot;&gt;&amp;</escapedWord><favoriteFoods>pizza</favoriteFoods><favoriteFoods>chocolate</favoriteFoods><address><street>123 Main St</street><city>New York</city><state>NY</state><country>USA</country></address>';

  const result = toSoapXML(obj);

  expect(result).toBe(expectedXML);
});

describe('correctInvalidXmlResponseTypes', () => {
  it('should correct invalid XML response types', () => {
    const item = {
      firstName: 'John',
      lastName: 'Doe',
      age: '30',
      isStudent: 'true',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      },
    };

    const expectedItem = {
      firstName: 'John',
      lastName: 'Doe',
      age: '30',
      isStudent: true,
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
      },
    };

    const result = correctInvalidXmlResponseTypes(item);

    expect(result).toEqual(expectedItem);
  });

  it('should set null for invalid XML response types', () => {
    const item = {
      firstName: 'John',
      lastName: 'Doe',
      age: '30',
      isStudent: 'false',
      address: {
        street: '123 Main St',
        city: 'New York',
        state: 'NY',
        country: 'USA',
        $: { 'xsi:nil': true },
      },
    };

    const expectedItem = {
      firstName: 'John',
      lastName: 'Doe',
      age: '30',
      isStudent: false,
      address: null,
    };

    const result = correctInvalidXmlResponseTypes(item);

    expect(result).toEqual(expectedItem);
  });
});

describe('prepareBulkApiRequestPayload', () => {
  it('should generate the correct XML payload for UPSERT operation with externalId', () => {
    const payload: any = {
      type: 'UPSERT',
      sObject: 'Account',
      assignmentRuleId: '123',
      serialMode: false,
      externalId: 'ExternalIdField',
      hasZipAttachment: false,
    };

    const expectedXML = `<?xml version="1.0" encoding="UTF-8"?>
<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
<operation>upsert</operation>
<object>Account</object>
<externalIdFieldName>ExternalIdField</externalIdFieldName>
<concurrencyMode>Parallel</concurrencyMode>
<contentType>CSV</contentType>
<assignmentRuleId>123</assignmentRuleId>
</jobInfo>`;

    const result = prepareBulkApiRequestPayload(payload);

    expect(result).toBe(expectedXML);
  });

  it('should generate the correct XML payload for INSERT operation with zip attachment', () => {
    const payload: any = {
      type: 'INSERT',
      sObject: 'Contact',
      assignmentRuleId: '',
      serialMode: true,
      externalId: '',
      hasZipAttachment: true,
    };

    const expectedXML = `<?xml version="1.0" encoding="UTF-8"?>
<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
<operation>insert</operation>
<object>Contact</object>
<concurrencyMode>Serial</concurrencyMode>
<contentType>ZIP_CSV</contentType>
</jobInfo>`;

    const result = prepareBulkApiRequestPayload(payload);

    expect(result).toBe(expectedXML);
  });

  it('should generate the correct XML payload for DELETE operation without assignment rule', () => {
    const payload: any = {
      type: 'DELETE',
      sObject: 'Lead',
      assignmentRuleId: '',
      serialMode: false,
      externalId: '',
      hasZipAttachment: false,
    };

    const expectedXML = `<?xml version="1.0" encoding="UTF-8"?>
<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
<operation>delete</operation>
<object>Lead</object>
<concurrencyMode>Parallel</concurrencyMode>
<contentType>CSV</contentType>
</jobInfo>`;

    const result = prepareBulkApiRequestPayload(payload);

    expect(result).toBe(expectedXML);
  });

  it('should generate the correct XML payload for HARD_DELETE operation without assignment rule', () => {
    const payload: any = {
      type: 'HARD_DELETE',
      sObject: 'Lead',
      assignmentRuleId: '',
      serialMode: false,
      externalId: '',
      hasZipAttachment: false,
    };

    const expectedXML = `<?xml version="1.0" encoding="UTF-8"?>
<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
<operation>hardDelete</operation>
<object>Lead</object>
<concurrencyMode>Parallel</concurrencyMode>
<contentType>CSV</contentType>
</jobInfo>`;

    const result = prepareBulkApiRequestPayload(payload);

    expect(result).toBe(expectedXML);
  });
});

describe('prepareCloseOrAbortJobPayload', () => {
  it('should generate the correct XML payload for closing a job', () => {
    const expectedXML = `<?xml version="1.0" encoding="UTF-8"?>
<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
<state>Closed</state>
</jobInfo>`;

    const result = prepareCloseOrAbortJobPayload('Closed');

    expect(result).toBe(expectedXML);
  });

  it('should generate the correct XML payload for aborting a job', () => {
    const expectedXML = `<?xml version="1.0" encoding="UTF-8"?>
<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload">
<state>Aborted</state>
</jobInfo>`;

    const result = prepareCloseOrAbortJobPayload('Aborted');

    expect(result).toBe(expectedXML);
  });
});

describe('getBinaryFileRecordQueryMap', () => {
  describe('attachment', () => {
    describe('query generation', () => {
      it('should generate a single query for fewer than 200 IDs', () => {
        const queryMap = getBinaryFileRecordQueryMap('name');
        const ids = Array.from({ length: 50 }, (_, i) => `id${i}`);

        const queries = queryMap.attachment.getQuery(ids);

        expect(queries).toHaveLength(1);
        expect(queries[0]).toContain('SELECT Id, Name, Body, BodyLength, ContentType');
        expect(queries[0]).toContain('FROM Attachment');
        expect(queries[0]).toContain('WHERE Id IN');
        expect(queries[0]).toContain('LIMIT 50');
      });

      it('should generate a single query for exactly 200 IDs', () => {
        const queryMap = getBinaryFileRecordQueryMap('name');
        const ids = Array.from({ length: 200 }, (_, i) => `id${i}`);

        const queries = queryMap.attachment.getQuery(ids);

        expect(queries).toHaveLength(1);
        expect(queries[0]).toContain('LIMIT 200');
      });

      it('should split into multiple queries for more than 200 IDs', () => {
        const queryMap = getBinaryFileRecordQueryMap('name');
        const ids = Array.from({ length: 450 }, (_, i) => `id${i}`);

        const queries = queryMap.attachment.getQuery(ids);

        expect(queries).toHaveLength(3);
        expect(queries[0]).toContain('LIMIT 200');
        expect(queries[1]).toContain('LIMIT 200');
        expect(queries[2]).toContain('LIMIT 50');
      });
    });

    describe('record transformation', () => {
      it('should transform records with fileNameFormat: "name"', () => {
        const queryMap = getBinaryFileRecordQueryMap('name');
        const records = [
          {
            Id: 'att001',
            Name: 'document.pdf',
            Body: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            BodyLength: 12345,
            ContentType: 'application/pdf',
          },
        ];

        const result = queryMap.attachment.transformToBinaryFileDownload(records);

        expect(result).toEqual([
          {
            id: 'att001',
            url: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            size: 12345,
            fileName: 'document.pdf',
            fileExtension: 'pdf',
          },
        ]);
      });

      it('should transform records with fileNameFormat: "id"', () => {
        const queryMap = getBinaryFileRecordQueryMap('id');
        const records = [
          {
            Id: 'att001',
            Name: 'document.pdf',
            Body: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            BodyLength: 12345,
            ContentType: 'application/pdf',
          },
        ];

        const result = queryMap.attachment.transformToBinaryFileDownload(records);

        expect(result).toEqual([
          {
            id: 'att001',
            url: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            size: 12345,
            fileName: 'att001',
            fileExtension: 'pdf',
          },
        ]);
      });

      it('should transform records with fileNameFormat: "nameAndId"', () => {
        const queryMap = getBinaryFileRecordQueryMap('nameAndId');
        const records = [
          {
            Id: 'att001',
            Name: 'document.pdf',
            Body: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            BodyLength: 12345,
            ContentType: 'application/pdf',
          },
        ];

        const result = queryMap.attachment.transformToBinaryFileDownload(records);

        expect(result).toEqual([
          {
            id: 'att001',
            url: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            size: 12345,
            fileName: 'document.pdf-att001',
            fileExtension: 'pdf',
          },
        ]);
      });

      it('should transform multiple records', () => {
        const queryMap = getBinaryFileRecordQueryMap('name');
        const records = [
          {
            Id: 'att001',
            Name: 'document1.pdf',
            Body: '/services/data/v50.0/sobjects/Attachment/att001/Body',
            BodyLength: 12345,
            ContentType: 'application/pdf',
          },
          {
            Id: 'att002',
            Name: 'image.png',
            Body: '/services/data/v50.0/sobjects/Attachment/att002/Body',
            BodyLength: 54321,
            ContentType: 'image/png',
          },
        ];

        const result = queryMap.attachment.transformToBinaryFileDownload(records);

        expect(result).toHaveLength(2);
        expect(result[0].fileName).toBe('document1.pdf');
        expect(result[1].fileName).toBe('image.png');
        expect(result[1].fileExtension).toBe('png');
      });
    });
  });

  describe('document', () => {
    it('should generate correct query', () => {
      const queryMap = getBinaryFileRecordQueryMap('name');
      const ids = ['doc001', 'doc002'];

      const queries = queryMap.document.getQuery(ids);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain('SELECT Id, Name, Body, BodyLength, Type');
      expect(queries[0]).toContain('FROM Document');
      expect(queries[0]).toContain('LIMIT 2');
    });

    it('should transform records correctly', () => {
      const queryMap = getBinaryFileRecordQueryMap('name');
      const records = [
        {
          Id: 'doc001',
          Name: 'report',
          Body: '/services/data/v50.0/sobjects/Document/doc001/Body',
          BodyLength: 98765,
          Type: 'pdf',
        },
      ];

      const result = queryMap.document.transformToBinaryFileDownload(records);

      expect(result).toEqual([
        {
          id: 'doc001',
          url: '/services/data/v50.0/sobjects/Document/doc001/Body',
          size: 98765,
          fileName: 'report',
          fileExtension: 'pdf',
        },
      ]);
    });

    it('should use Type field as file extension', () => {
      const queryMap = getBinaryFileRecordQueryMap('id');
      const records = [
        {
          Id: 'doc001',
          Name: 'spreadsheet',
          Body: '/services/data/v50.0/sobjects/Document/doc001/Body',
          BodyLength: 45678,
          Type: 'xls',
        },
      ];

      const result = queryMap.document.transformToBinaryFileDownload(records);

      expect(result[0].fileName).toBe('doc001');
      expect(result[0].fileExtension).toBe('xls');
    });
  });

  describe('staticresource', () => {
    it('should generate correct query', () => {
      const queryMap = getBinaryFileRecordQueryMap('name');
      const ids = ['sr001'];

      const queries = queryMap.staticresource.getQuery(ids);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain('SELECT Id, Name, Body, BodyLength, ContentType');
      expect(queries[0]).toContain('FROM StaticResource');
      expect(queries[0]).toContain('LIMIT 1');
    });

    it('should transform records correctly', () => {
      const queryMap = getBinaryFileRecordQueryMap('nameAndId');
      const records = [
        {
          Id: 'sr001',
          Name: 'MyResource',
          Body: '/services/data/v50.0/sobjects/StaticResource/sr001/Body',
          BodyLength: 102400,
          ContentType: 'application/zip',
        },
      ];

      const result = queryMap.staticresource.transformToBinaryFileDownload(records);

      expect(result).toEqual([
        {
          id: 'sr001',
          url: '/services/data/v50.0/sobjects/StaticResource/sr001/Body',
          size: 102400,
          fileName: 'MyResource-sr001',
          fileExtension: 'zip',
        },
      ]);
    });
  });

  describe('contentversion', () => {
    it('should generate correct query', () => {
      const queryMap = getBinaryFileRecordQueryMap('name');
      const ids = ['cv001', 'cv002', 'cv003'];

      const queries = queryMap.contentversion.getQuery(ids);

      expect(queries).toHaveLength(1);
      expect(queries[0]).toContain('SELECT Id, PathOnClient, Title, FileExtension, VersionData, ContentSize');
      expect(queries[0]).toContain('FROM ContentVersion');
      expect(queries[0]).toContain('LIMIT 3');
    });

    it('should transform records using Title field for name format', () => {
      const queryMap = getBinaryFileRecordQueryMap('name');
      const records = [
        {
          Id: 'cv001',
          PathOnClient: '/path/to/file.docx',
          Title: 'Important Document',
          FileExtension: 'docx',
          VersionData: '/services/data/v50.0/sobjects/ContentVersion/cv001/VersionData',
          ContentSize: 204800,
        },
      ];

      const result = queryMap.contentversion.transformToBinaryFileDownload(records);

      expect(result).toEqual([
        {
          id: 'cv001',
          url: '/services/data/v50.0/sobjects/ContentVersion/cv001/VersionData',
          size: 204800,
          fileName: 'Important Document',
          fileExtension: 'docx',
        },
      ]);
    });

    it('should use FileExtension field directly', () => {
      const queryMap = getBinaryFileRecordQueryMap('id');
      const records = [
        {
          Id: 'cv002',
          PathOnClient: '/path/to/presentation.pptx',
          Title: 'Q4 Presentation',
          FileExtension: 'pptx',
          VersionData: '/services/data/v50.0/sobjects/ContentVersion/cv002/VersionData',
          ContentSize: 5242880,
        },
      ];

      const result = queryMap.contentversion.transformToBinaryFileDownload(records);

      expect(result[0].fileName).toBe('cv002');
      expect(result[0].fileExtension).toBe('pptx');
    });

    it('should handle multiple ContentVersion records', () => {
      const queryMap = getBinaryFileRecordQueryMap('nameAndId');
      const records = [
        {
          Id: 'cv001',
          PathOnClient: '/path/to/file1.txt',
          Title: 'File One',
          FileExtension: 'txt',
          VersionData: '/services/data/v50.0/sobjects/ContentVersion/cv001/VersionData',
          ContentSize: 1024,
        },
        {
          Id: 'cv002',
          PathOnClient: '/path/to/file2.csv',
          Title: 'File Two',
          FileExtension: 'csv',
          VersionData: '/services/data/v50.0/sobjects/ContentVersion/cv002/VersionData',
          ContentSize: 2048,
        },
      ];

      const result = queryMap.contentversion.transformToBinaryFileDownload(records);

      expect(result).toHaveLength(2);
      expect(result[0].fileName).toBe('File One-cv001');
      expect(result[1].fileName).toBe('File Two-cv002');
    });
  });

  describe('query splitting for all object types', () => {
    it('should split queries consistently across all object types', () => {
      const queryMap = getBinaryFileRecordQueryMap('name');
      const ids = Array.from({ length: 401 }, (_, i) => `id${i}`);

      const attachmentQueries = queryMap.attachment.getQuery(ids);
      const documentQueries = queryMap.document.getQuery(ids);
      const staticResourceQueries = queryMap.staticresource.getQuery(ids);
      const contentVersionQueries = queryMap.contentversion.getQuery(ids);

      // All should split into 3 queries (200 + 200 + 1)
      expect(attachmentQueries).toHaveLength(3);
      expect(documentQueries).toHaveLength(3);
      expect(staticResourceQueries).toHaveLength(3);
      expect(contentVersionQueries).toHaveLength(3);
    });
  });
});
