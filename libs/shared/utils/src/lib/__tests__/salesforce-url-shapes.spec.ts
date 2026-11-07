import { describe, expect, it } from 'vitest';
import { isHostRelativeUrlPath, isQueryLocatorUrl, isSObjectBlobFieldUrl } from '../salesforce-url-shapes';

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

describe('isHostRelativeUrlPath', () => {
  it.each([
    '/',
    '/lightning/page/home',
    '/lightning/setup/ObjectManager/Account/Details/view',
    '/0015g00000AbCdEAAX',
    '/lightning/setup/ManageUsers/page?address=%2F0055g0000012345%3Fnoredirect%3D1',
    '/lightning/setup/AsyncApiJobStatus/page?address=%2F7505g00000ABCDE',
  ])('accepts a host-relative path (%s)', (value) => {
    expect(isHostRelativeUrlPath(value)).toBe(true);
  });

  it.each([
    '',
    'lightning/page/home',
    'https://evil.example/',
    'javascript:alert(1)',
    '//evil.example/lightning/page/home',
    '/\\evil.example/lightning/page/home',
    '/lightning\\..\\evil',
    '/lightning/page home',
    '/lightning/page\thome',
    '/lightning/page\x00home',
    '/lightning/page\nhome',
    ' /lightning/page/home',
    42,
    null,
    undefined,
  ])('refuses anything that is not a host-relative path (%s)', (value) => {
    expect(isHostRelativeUrlPath(value)).toBe(false);
  });
});
