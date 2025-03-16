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
        '<types>',
        ...testData.CustomObject.map((name) => `<members>${name}</members>`),
        '<name>CustomObject</name>',
        '</types>',
        '<types>',
        ...testData.RecordType.map((name) => `<members>${name}</members>`),
        '<name>RecordType</name>',
        '</types>',
        '<version>99.0</version>',
        '</Package>',
      ].join('')
    );
  });
});
