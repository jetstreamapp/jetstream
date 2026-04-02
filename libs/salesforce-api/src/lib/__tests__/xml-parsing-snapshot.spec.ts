/**
 * Snapshot-style tests that pin the exact output shapes of XML parsing and building.
 * These use the exact option configurations from callout-adapter.ts and salesforce-package.utils.ts.
 * Purpose: catch any behavioral differences when swapping fast-xml-parser/fast-xml-builder for @jetstreamapp/simple-xml.
 */
import { build, parse } from '@jetstreamapp/simple-xml';
import { describe, expect, it } from 'vitest';
import { CALLOUT_ADAPTER_PARSE_OPTIONS } from '../callout-adapter';
import { PACKAGE_BUILD_OPTIONS, PACKAGE_MANIFEST_PARSE_OPTIONS } from '../salesforce-package.utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCalloutAdapter(xml: string) {
  return parse(xml, CALLOUT_ADAPTER_PARSE_OPTIONS);
}

function parsePackageManifest(xml: string) {
  return parse(xml, PACKAGE_MANIFEST_PARSE_OPTIONS);
}

function buildFormatted(obj: Record<string, unknown>) {
  return build(obj, { ...PACKAGE_BUILD_OPTIONS, format: true });
}

function buildCompact(obj: Record<string, unknown>) {
  return build(obj, { ...PACKAGE_BUILD_OPTIONS, format: false });
}

// ─── Section 1: Parser with callout-adapter options ──────────────────────────

describe('XML parser with callout-adapter options', () => {
  it('should produce exact shape for xsi:nil attribute', () => {
    const result = parseCalloutAdapter('<root><compileProblem xsi:nil="true"/></root>');
    expect(result).toEqual({
      root: { compileProblem: { '@_nil': 'true' } },
    });
  });

  it('should coerce booleans and numbers with parseTagValue default (true)', () => {
    const result = parseCalloutAdapter(
      '<result><done>true</done><count>42</count><version>65.0</version><name>test</name><negative>-1</negative><success>false</success></result>',
    );
    expect(result).toEqual({
      result: {
        done: true,
        count: 42,
        version: 65,
        name: 'test',
        negative: -1,
        success: false,
      },
    });
    // Verify types explicitly
    const resultObj = result.result as Record<string, unknown>;
    expect(typeof resultObj.done).toBe('boolean');
    expect(typeof resultObj.count).toBe('number');
    expect(typeof resultObj.version).toBe('number');
    expect(typeof resultObj.name).toBe('string');
    expect(typeof resultObj.success).toBe('boolean');
  });

  it('should represent empty and self-closing elements as empty strings', () => {
    expect(parseCalloutAdapter('<root><data/></root>')).toEqual({
      root: { data: '' },
    });
    expect(parseCalloutAdapter('<root><data></data></root>')).toEqual({
      root: { data: '' },
    });
  });

  it('should drop xmlns attribute when removeNSPrefix is true', () => {
    const result = parseCalloutAdapter(
      '<jobInfo xmlns="http://www.force.com/2009/06/asyncapi/dataload"><id>123</id><state>Open</state></jobInfo>',
    );
    // xmlns is dropped entirely - no @_xmlns key
    expect(result).toEqual({
      jobInfo: { id: 123, state: 'Open' },
    });
    expect(result.jobInfo).not.toHaveProperty('@_xmlns');
    expect(result.jobInfo).not.toHaveProperty('@xmlns');
  });

  it('should preserve CDATA content as text', () => {
    const result = parseCalloutAdapter('<root><debugLog><![CDATA[Line 1 with <special> chars]]></debugLog></root>');
    expect(result).toEqual({
      root: { debugLog: 'Line 1 with <special> chars' },
    });
  });

  it('should NOT decode XML entities when processEntities is false', () => {
    const result = parseCalloutAdapter('<root><value>A &amp; B &lt; C</value></root>');
    expect(result).toEqual({
      root: { value: 'A &amp; B &lt; C' },
    });
  });

  it('should produce exact shape for elements with both attributes and children', () => {
    const result = parseCalloutAdapter(
      '<root><item type="Account" url="/services/data/v65.0/sobjects/Account/001"><Id>001</Id><Name>test</Name></item></root>',
    );
    expect(result).toEqual({
      root: {
        item: {
          '@_type': 'Account',
          '@_url': '/services/data/v65.0/sobjects/Account/001',
          Id: 1,
          Name: 'test',
        },
      },
    });
  });

  it('should strip namespace prefixes from element names', () => {
    const result = parseCalloutAdapter(
      '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"><soapenv:Body><response><value>1</value></response></soapenv:Body></soapenv:Envelope>',
    );
    expect(result).toEqual({
      Envelope: { Body: { response: { value: 1 } } },
    });
  });

  it('should return single child as value, multiple same-name children as array', () => {
    // Single child -> direct value
    expect(parseCalloutAdapter('<root><items><item>one</item></items></root>')).toEqual({
      root: { items: { item: 'one' } },
    });
    // Multiple children -> array
    expect(parseCalloutAdapter('<root><items><item>one</item><item>two</item></items></root>')).toEqual({
      root: { items: { item: ['one', 'two'] } },
    });
  });

  it('should represent empty text elements as empty strings', () => {
    const result = parseCalloutAdapter(
      '<result><organizationNamespace></organizationNamespace><testRequired>false</testRequired></result>',
    );
    expect(result).toEqual({
      result: { organizationNamespace: '', testRequired: false },
    });
  });

  it('should handle full SOAP envelope with mixed namespaces', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns="http://soap.sforce.com/2006/04/metadata">
  <soapenv:Body>
    <retrieveResponse>
      <result>
        <done>false</done>
        <id>09SKf000002knYIMAY</id>
        <state>Queued</state>
      </result>
    </retrieveResponse>
  </soapenv:Body>
</soapenv:Envelope>`;
    const result = parseCalloutAdapter(xml);
    expect(result).toEqual({
      Envelope: {
        Body: {
          retrieveResponse: {
            result: {
              done: false,
              id: '09SKf000002knYIMAY',
              state: 'Queued',
            },
          },
        },
      },
    });
  });

  it('should handle elements with xsi:nil alongside normal siblings', () => {
    const xml = `<result>
      <column>-1</column>
      <compileProblem xsi:nil="true"/>
      <compiled>true</compiled>
      <exceptionMessage xsi:nil="true"/>
      <exceptionStackTrace xsi:nil="true"/>
      <line>-1</line>
      <success>true</success>
    </result>`;
    const result = parseCalloutAdapter(xml);
    expect(result).toEqual({
      result: {
        column: -1,
        compileProblem: { '@_nil': 'true' },
        compiled: true,
        exceptionMessage: { '@_nil': 'true' },
        exceptionStackTrace: { '@_nil': 'true' },
        line: -1,
        success: true,
      },
    });
  });

  it('should handle multiple same-name elements at SOAP response level', () => {
    const xml = `<listMetadataResponse>
      <result><fullName>ClassA</fullName><type>ApexClass</type></result>
      <result><fullName>ClassB</fullName><type>ApexClass</type></result>
    </listMetadataResponse>`;
    const result = parseCalloutAdapter(xml);
    expect(result).toEqual({
      listMetadataResponse: {
        result: [
          { fullName: 'ClassA', type: 'ApexClass' },
          { fullName: 'ClassB', type: 'ApexClass' },
        ],
      },
    });
  });

  it('should handle self-closing elements without attributes (empty response body)', () => {
    const xml = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">
      <soapenv:Body><listMetadataResponse/></soapenv:Body>
    </soapenv:Envelope>`;
    const result = parseCalloutAdapter(xml);
    expect(result).toEqual({
      Envelope: { Body: { listMetadataResponse: '' } },
    });
  });
});

// ─── Section 2: Parser with salesforce-package.utils options ─────────────────

describe('XML parser with salesforce-package.utils options', () => {
  it('should keep all values as strings when parseTagValue is false', () => {
    const result = parsePackageManifest('<Package><version>60.0</version><count>5</count><active>true</active></Package>');
    expect(result).toEqual({
      Package: { version: '60.0', count: '5', active: 'true' },
    });
    const pkg = result.Package as Record<string, unknown>;
    expect(typeof pkg.version).toBe('string');
    expect(typeof pkg.count).toBe('string');
    expect(typeof pkg.active).toBe('string');
  });

  it('should drop all attributes when ignoreAttributes is true', () => {
    const result = parsePackageManifest('<Package xmlns="http://soap.sforce.com/2006/04/metadata"><version>60.0</version></Package>');
    expect(result).toEqual({
      Package: { version: '60.0' },
    });
    const pkg = result.Package as Record<string, unknown>;
    expect(pkg).not.toHaveProperty('@xmlns');
    expect(pkg).not.toHaveProperty('@_xmlns');
  });

  it('should ignore comments and trim whitespace in values', () => {
    const result = parsePackageManifest('<root><!--comment--><name>   ApexClass  </name><value>test</value></root>');
    expect(result).toEqual({
      root: { name: 'ApexClass', value: 'test' },
    });
  });

  it('should parse full package manifest with multiple types', () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <!--Comments should be ignored-->
  <types>
    <members>ClassA</members>
    <members>ClassB</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>PageA</members>
    <name>ApexPage</name>
  </types>
  <version>60.0</version>
</Package>`;
    const result = parsePackageManifest(xml);
    expect(result).toEqual({
      Package: {
        types: [
          { members: ['ClassA', 'ClassB'], name: 'ApexClass' },
          { members: 'PageA', name: 'ApexPage' },
        ],
        version: '60.0',
      },
    });
  });
});

// ─── Section 3: Builder with salesforce-package.utils options ────────────────

describe('XML builder with salesforce-package.utils options', () => {
  it('should render attributes from keys with @ prefix', () => {
    const result = buildCompact({
      Package: { '@xmlns': 'http://soap.sforce.com/2006/04/metadata', version: '60.0' },
    });
    expect(result).toBe('<Package xmlns="http://soap.sforce.com/2006/04/metadata"><version>60.0</version></Package>');
  });

  it('should render empty string values as empty elements (not self-closing)', () => {
    const result = buildCompact({ root: { emptyField: '' } });
    expect(result).toBe('<root><emptyField></emptyField></root>');
  });

  it('should render null as self-closing and omit undefined', () => {
    const result = buildCompact({ root: { nullField: null, undefField: undefined, version: '1.0' } });
    expect(result).toBe('<root><nullField/><version>1.0</version></root>');
  });

  it('should render arrays as repeated elements', () => {
    const result = buildCompact({
      root: { types: [{ name: 'A' }, { name: 'B' }] },
    });
    expect(result).toBe('<root><types><name>A</name></types><types><name>B</name></types></root>');
  });

  it('should produce indented output when format is true', () => {
    const result = buildFormatted({
      root: { child: { name: 'test' }, version: '1.0' },
    });
    expect(result).toBe('<root>\n  <child>\n    <name>test</name>\n  </child>\n  <version>1.0</version>\n</root>\n');
  });

  it('should produce compact output when format is false', () => {
    const result = buildCompact({
      root: { child: { name: 'test' }, version: '1.0' },
    });
    expect(result).toBe('<root><child><name>test</name></child><version>1.0</version></root>');
  });

  it('should render #text with attributes correctly', () => {
    const result = buildCompact({
      root: { item: { '@id': '1', '#text': 'hello' } },
    });
    expect(result).toBe('<root><item id="1">hello</item></root>');
  });

  it('should build full package.xml matching expected format', () => {
    const result = buildFormatted({
      Package: {
        '@xmlns': 'http://soap.sforce.com/2006/04/metadata',
        types: [
          {
            members: ['ClassA', 'ClassB'],
            name: 'ApexClass',
          },
          {
            members: 'PageA',
            name: 'ApexPage',
          },
        ],
        version: '60.0',
      },
    });
    expect(result).toBe(
      `<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>ClassA</members>
    <members>ClassB</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>PageA</members>
    <name>ApexPage</name>
  </types>
  <version>60.0</version>
</Package>
`,
    );
  });
});

// ─── Section 4: Round-trip fidelity ──────────────────────────────────────────

describe('XML round-trip: build then parse', () => {
  it('should round-trip a package.xml through build and parse', () => {
    const input = {
      Package: {
        '@xmlns': 'http://soap.sforce.com/2006/04/metadata',
        types: [
          { members: ['ClassA', 'ClassB', 'ClassC'], name: 'ApexClass' },
          { members: 'TriggerA', name: 'ApexTrigger' },
        ],
        version: '60.0',
      },
    };

    // Build with formatted options
    const xml = buildFormatted(input);

    // Parse back with package manifest options (ignoreAttributes, parseTagValue false)
    const parsed = parsePackageManifest(xml);

    // Verify semantic equivalence (attributes are dropped by parser, values are strings)
    const parsedPkg = parsed.Package as Record<string, unknown>;
    expect(parsedPkg.version).toBe('60.0');
    expect(parsedPkg.types).toEqual([
      { members: ['ClassA', 'ClassB', 'ClassC'], name: 'ApexClass' },
      { members: 'TriggerA', name: 'ApexTrigger' },
    ]);
  });
});
