import { describe, expect, it } from 'vitest';
import { isQueryLocatorUrl, isSObjectBlobFieldUrl } from '../salesforce-url-shapes';

describe('isQueryLocatorUrl', () => {
  it.each([
    '/services/data/v68.0/query/0r8xx6389B7IaNcAQK-2000',
    '/services/data/v50.0/query/01gRM000003bgWuYAI-4000',
    '/services/data/v62.0/queryAll/0r8xx6389CFZgOHAQ1-2000',
    '/services/data/v62.0/tooling/query/01gxx000000ABCDEFG-2000',
    '/services/data/v62.0/tooling/queryAll/01gxx000000ABCDEFG-6000',
  ])('accepts the cursor shape Salesforce returns (%s)', (cursor) => {
    expect(isQueryLocatorUrl(cursor)).toBe(true);
  });

  it.each([
    '',
    'https://my-org.my.salesforce.com/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000',
    '/services/data/v62.0/query/0r8xx6389B7IaNcAQK',
    '/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000/',
    '/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000?x=1',
    '/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000#x',
    '/services/data/v62.0/query/0r8xx63%2089B7IaNcAQK-2000',
    '/services/data/v62.0/query?q=SELECT+Id+FROM+Account',
    '/services/data/v62.0/tooling/executeAnonymous/?anonymousBody=x',
    '/services/data/v62.0/tooling/executeAnonymous/0r8xx6389B7IaNcAQK-2000',
    '/services/apexrest/query/0r8xx6389B7IaNcAQK-2000',
    '/services/data/v62.0/sobjects/Account/0r8xx6389B7IaNcAQK-2000',
    '/services/data/v62.0/../query/0r8xx6389B7IaNcAQK-2000',
    '//evil.example/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000',
  ])('refuses anything that is not a query locator (%s)', (value) => {
    expect(isQueryLocatorUrl(value)).toBe(false);
  });

  it('refuses non-string values', () => {
    expect(isQueryLocatorUrl(undefined)).toBe(false);
    expect(isQueryLocatorUrl(null)).toBe(false);
    expect(isQueryLocatorUrl(['/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000'])).toBe(false);
  });
});

describe('isSObjectBlobFieldUrl', () => {
  it.each([
    '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData',
    '/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body',
    '/services/data/v54.0/sobjects/Attachment/00P6g000007BzmT/Body',
    '/services/data/v62.0/sobjects/Document/0156g00000AbCdEfGH/Body',
    '/services/data/v62.0/sobjects/EventLogFile/0AT6g00000AbCdEfGH/LogFile',
    '/services/data/v62.0/tooling/sobjects/ApexLog/07L6g00000AbCdEfGH/Body',
    '/services/data/v62.0/sobjects/My_Object__c/a006g00000AbCdEfGH/Custom_Blob__c',
  ])('accepts a record blob field path (%s)', (url) => {
    expect(isSObjectBlobFieldUrl(url)).toBe(true);
  });

  it.each([
    '',
    'https://my-org.my.salesforce.com/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData',
    '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP',
    '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData/',
    '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData?x=1',
    '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/VersionData&X-SFDC-ID=00D-005',
    '/services/data/v60.0/sobjects/ContentVersion/../../tooling/executeAnonymous/x',
    '/services/data/v62.0/tooling/executeAnonymous/?anonymousBody=x',
    '/services/data/v62.0/query/0r8xx6389B7IaNcAQK-2000',
    '/services/data/v62.0/composite/sobjects/Account/001/Body',
    '/services/apexrest/sobjects/Account/0016g00000AbCdEfGH/Body',
    '/services/data/v60.0/sobjects/ContentVersion/068Dn0000%20BSXTsIAP/VersionData',
    '/services/data/v60.0/sobjects/ContentVersion/068Dn00000BSXTsIAP/Version%20Data',
  ])('refuses anything that is not a record blob field path (%s)', (value) => {
    expect(isSObjectBlobFieldUrl(value)).toBe(false);
  });

  it('refuses non-string values', () => {
    expect(isSObjectBlobFieldUrl(undefined)).toBe(false);
    expect(isSObjectBlobFieldUrl(42)).toBe(false);
  });
});
