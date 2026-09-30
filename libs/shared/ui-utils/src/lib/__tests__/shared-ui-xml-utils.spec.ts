import { xmlUtils } from '../shared-ui-xml-utils';

describe('generatePackageXml', () => {
  it('should output correct XML', () => {
    const testData = {
      CustomObject: ['Account', 'Contact'],
      RecordType: ['Account.RecordType1', 'Lead.RecordType1'],
    };
    const packageXml = xmlUtils.generatePackageXml('v99.0', testData);
    expect(packageXml).toEqual(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <types>',
        ...testData.CustomObject.map((name) => `    <members>${name}</members>`),
        '    <name>CustomObject</name>',
        '  </types>',
        '  <types>',
        ...testData.RecordType.map((name) => `    <members>${name}</members>`),
        '    <name>RecordType</name>',
        '  </types>',
        '  <version>99.0</version>',
        '</Package>',
        '',
      ].join('\n'),
    );
  });

  it('should require an api version', () => {
    expect(() => xmlUtils.generatePackageXml('', { CustomObject: ['Account'] })).toThrow('API version is required');
  });
});

describe('buildMetadataXml', () => {
  it('should write exactly one declaration and one namespace', () => {
    const xml = xmlUtils.buildMetadataXml('CustomObject', { recordTypes: [{ fullName: 'A' }, { fullName: 'B' }] });
    expect(xml.match(/<\?xml /g)).toHaveLength(1);
    expect(xml.match(/xmlns=/g)).toHaveLength(1);
  });

  it('should escape text, preserve multi-line text, and skip undefined values', () => {
    const xml = xmlUtils.buildMetadataXml('CustomObject', {
      recordTypes: [{ fullName: 'Support', businessProcess: undefined, description: 'Line one\nLine two <b> & "quoted"' }],
    });
    expect(xml).toEqual(
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <recordTypes>',
        '    <fullName>Support</fullName>',
        '    <description>Line one\nLine two &lt;b&gt; &amp; &quot;quoted&quot;</description>',
        '  </recordTypes>',
        '</CustomObject>',
        '',
      ].join('\n'),
    );
  });
});

describe('XSLTProcessor independence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Chromium 154 injects an XSLT deprecation banner (an xhtml <div>) into every document XSLTProcessor returns.
  // It ended up inside package.xml and Salesforce rejected the deploy.
  it('should never use XSLTProcessor to build a file', () => {
    const XSLTProcessor = vi.fn(() => {
      throw new Error('XSLTProcessor should not be used');
    });
    vi.stubGlobal('XSLTProcessor', XSLTProcessor);

    const packageXml = xmlUtils.generatePackageXml('v99.0', { CustomObject: ['Account'] });
    const objectXml = xmlUtils.buildMetadataXml('CustomObject', { recordTypes: [{ fullName: 'A' }] });

    expect(XSLTProcessor).not.toHaveBeenCalled();
    expect(`${packageXml}${objectXml}`).not.toContain('<div');
  });
});
