import { SFDC_MY_DOMAIN_LOGIN_URL_REGEX } from '@jetstream/shared/constants';
import { describe, expect, it } from 'vitest';
import { parseSalesforceLoginUrl } from '../salesforce-login-url.utils';

describe('parseSalesforceLoginUrl', () => {
  describe('production and developer domains', () => {
    it.each([
      ['acme', 'https://acme.my.salesforce.com'],
      ['acme.my.salesforce.com', 'https://acme.my.salesforce.com'],
      ['https://acme.my.salesforce.com', 'https://acme.my.salesforce.com'],
      ['https://acme.my.salesforce.com/', 'https://acme.my.salesforce.com'],
      ['http://acme.my.salesforce.com', 'https://acme.my.salesforce.com'],
      ['https://acme.lightning.force.com/lightning/o/Account/list', 'https://acme.my.salesforce.com'],
      ['ACME.My.Salesforce.Com', 'https://acme.my.salesforce.com'],
      ['  acme  ', 'https://acme.my.salesforce.com'],
    ])('normalizes %s', (input, expected) => {
      const result = parseSalesforceLoginUrl(input);
      expect(result).toEqual({ success: true, myDomain: 'acme', isSandbox: false, loginUrl: expected });
    });
  });

  describe('sandbox domains', () => {
    it.each([
      ['acme--uat'],
      ['acme--uat.sandbox'],
      ['acme--uat.sandbox.my.salesforce.com'],
      ['https://acme--uat.sandbox.my.salesforce.com/'],
      ['https://acme--uat.sandbox.lightning.force.com/lightning/page/home'],
    ])('infers the sandbox suffix for %s', (input) => {
      expect(parseSalesforceLoginUrl(input)).toEqual({
        success: true,
        myDomain: 'acme--uat.sandbox',
        isSandbox: true,
        loginUrl: 'https://acme--uat.sandbox.my.salesforce.com',
      });
    });
  });

  describe('develop domains', () => {
    it.each([
      ['acme.develop', 'acme.develop'],
      ['acme.develop.my.salesforce.com', 'acme.develop'],
      ['https://acme.develop.lightning.force.com/lightning', 'acme.develop'],
      ['acme--dev.develop.my.salesforce.com', 'acme--dev.develop'],
    ])('preserves the develop segment for %s', (input, myDomain) => {
      expect(parseSalesforceLoginUrl(input)).toEqual({
        success: true,
        myDomain,
        isSandbox: false,
        loginUrl: `https://${myDomain}.my.salesforce.com`,
      });
    });
  });

  describe('explicit .sandbox segment', () => {
    it('is honored even without a -- in the domain', () => {
      expect(parseSalesforceLoginUrl('acme.sandbox.my.salesforce.com')).toEqual({
        success: true,
        myDomain: 'acme.sandbox',
        isSandbox: true,
        loginUrl: 'https://acme.sandbox.my.salesforce.com',
      });
    });
  });

  describe('other enhanced domain environments', () => {
    // A host we recognized is passed through verbatim, so environments we never enumerated still work
    it.each([
      ['acme.scratch.my.salesforce.com', 'https://acme.scratch.my.salesforce.com'],
      ['https://acme.trailblaze.my.salesforce.com', 'https://acme.trailblaze.my.salesforce.com'],
      ['acme.demo.my.salesforce.com', 'https://acme.demo.my.salesforce.com'],
      // Legacy instance-scoped sandbox host
      ['acme--uat.cs123.my.salesforce.com', 'https://acme--uat.cs123.my.salesforce.com'],
      // Shorthand for an environment the user typed by hand
      ['acme.scratch', 'https://acme.scratch.my.salesforce.com'],
    ])('keeps the environment segment for %s', (input, expected) => {
      const result = parseSalesforceLoginUrl(input);
      expect(result.success && result.loginUrl).toBe(expected);
    });
  });

  describe('rejects login endpoints and legacy instance urls', () => {
    // These are not My Domains - stripping a bare `.salesforce.com` would silently invent
    // `https://login.my.salesforce.com`, which is worse than telling the user we did not understand.
    it.each([
      ['https://login.salesforce.com'],
      ['https://test.salesforce.com'],
      ['https://na139.salesforce.com'],
      ['https://prerellogin.pre.salesforce.com'],
    ])('rejects %s', (input) => {
      expect(parseSalesforceLoginUrl(input).success).toBe(false);
    });
  });

  describe('rejects invalid input', () => {
    it.each([
      [''],
      ['   '],
      ['not a domain'],
      ['https://evil.com'],
      ['acme.my.salesforce.com.evil.com'],
      ['https://google.com/salesforce'],
    ])('rejects %s', (input) => {
      const result = parseSalesforceLoginUrl(input);
      expect(result.success).toBe(false);
    });

    it('rejects a domain with unsupported characters', () => {
      const result = parseSalesforceLoginUrl('acme_uat');
      expect(result).toEqual({ success: false, error: 'Domains can only contain letters, numbers, and hyphens' });
    });
  });

  const VALID_INPUTS = [
    'acme',
    'acme--uat',
    'acme--uat.sandbox',
    'acme.develop.my.salesforce.com',
    'acme.sandbox.my.salesforce.com',
    'acme.scratch.my.salesforce.com',
    'acme--uat.cs123.my.salesforce.com',
    'https://acme--uat.sandbox.lightning.force.com/lightning/page/home',
  ];

  it('produces urls the server allowlist accepts', () => {
    VALID_INPUTS.forEach((input) => {
      const result = parseSalesforceLoginUrl(input);
      expect(result.success).toBe(true);
      expect(result.success && result.loginUrl).toMatch(SFDC_MY_DOMAIN_LOGIN_URL_REGEX);
    });
  });

  // Reconnecting prefills the field with the host from `loginUrl` and re-parses whatever the user
  // leaves there, so parsing has to be a fixed point on its own output - otherwise reconnecting
  // silently points at a domain the org does not serve.
  it('re-parses its own login url to the same result', () => {
    VALID_INPUTS.forEach((input) => {
      const result = parseSalesforceLoginUrl(input);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(parseSalesforceLoginUrl(result.loginUrl)).toEqual(result);
    });
  });

  it('returns a myDomain that re-parses to the same login url', () => {
    VALID_INPUTS.forEach((input) => {
      const result = parseSalesforceLoginUrl(input);
      if (!result.success) {
        return;
      }
      const reparsed = parseSalesforceLoginUrl(result.myDomain);
      // Shorthand only covers documented environment segments, so a legacy instance-scoped host
      // (`acme--uat.cs123`) is not valid shorthand - the full host above is what the app feeds back
      if (reparsed.success) {
        expect(reparsed.loginUrl).toBe(result.loginUrl);
      }
    });
  });
});
