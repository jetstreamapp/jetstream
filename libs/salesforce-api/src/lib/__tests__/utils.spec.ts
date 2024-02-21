import { ApiConnection } from '../connection';
import { SalesforceApi, correctInvalidXmlResponseTypes, prepareCloseOrAbortJobPayload, toSoapXML } from '../utils';

describe('getRestApiUrl', () => {
  const apiConnection = new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: jest.fn(),
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

import { correctInvalidArrayXmlResponseTypes, prepareBulkApiRequestPayload } from '../utils';

describe('getRestApiUrl', () => {
  const apiConnection = new ApiConnection({
    accessToken: 'test',
    apiRequestAdapter: jest.fn(),
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
    apiRequestAdapter: jest.fn(),
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
