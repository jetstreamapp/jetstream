import { buildPackageXml, getRetrieveRequestFromManifest } from '../salesforce-package.utils';

describe('buildPackageXml', () => {
  it('should work', () => {
    expect(
      buildPackageXml(
        {
          ApexClass: [
            {
              fullName: 'AccountOverrideControllerExt',
            },
            {
              fullName: 'AccountTriggerHandler',
            },
            {
              fullName: 'AddPrimaryContact',
            },
            {
              fullName: 'SBQQ__AccountExtController',
              namespacePrefix: 'SBQQ',
            },
          ],
          ApexComponent: [
            {
              fullName: 'SiteFooter',
            },
          ],
          ApexPage: [
            {
              fullName: 'AnswersHome',
            },
          ],
        } as any,
        '60.0',
        {}
      )
    ).toEqual(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>AccountOverrideControllerExt</members>
    <members>AccountTriggerHandler</members>
    <members>AddPrimaryContact</members>
    <members>SBQQ__AccountExtController</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>SiteFooter</members>
    <name>ApexComponent</name>
  </types>
  <types>
    <members>AnswersHome</members>
    <name>ApexPage</name>
  </types>
  <version>60.0</version>
</Package>`);
  });
});

describe('getRetrieveRequestFromManifest', () => {
  it('should work', () => {
    expect(
      getRetrieveRequestFromManifest(`<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>AccountOverrideControllerExt</members>
    <members>AccountTriggerHandler</members>
    <members>AddPrimaryContact</members>
    <members>ApexUtilsTest</members>
    <members>SBQQ__AccountExtController</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>SiteFooter</members>
    <name>ApexComponent</name>
  </types>
  <types>
    <members>AnswersHome</members>
    <name>ApexPage</name>
  </types>
  <version>60.0</version>
</Package>`)
    ).toEqual({
      apiVersion: '60.0',
      unpackaged: {
        types: [
          {
            members: [
              'AccountOverrideControllerExt',
              'AccountTriggerHandler',
              'AddPrimaryContact',
              'ApexUtilsTest',
              'SBQQ__AccountExtController',
            ],
            name: 'ApexClass',
          },
          {
            members: 'SiteFooter',
            name: 'ApexComponent',
          },
          {
            members: 'AnswersHome',
            name: 'ApexPage',
          },
        ],
        version: '60.0',
      },
    });
  });
});
