import { describe, expect, it } from 'vitest';
import { extractOrgUniqueId, hashSessionId, sanitizeReferer, sanitizeUrl } from '../api-logger';

describe('sanitizeReferer', () => {
  it('strips the query string while preserving origin + path', () => {
    const referer = 'https://getjetstream.app/oauth-link/?type=salesforce&data=%7B%22email%22%3A%22person%40frs.net%22%7D';
    expect(sanitizeReferer(referer)).toBe('https://getjetstream.app/oauth-link/');
  });

  it('returns the referer unchanged when there is no query string', () => {
    expect(sanitizeReferer('https://getjetstream.app/oauth-link/')).toBe('https://getjetstream.app/oauth-link/');
  });

  it('passes through nullish/empty values without throwing', () => {
    expect(sanitizeReferer(undefined)).toBeUndefined();
    expect(sanitizeReferer('')).toBe('');
  });

  it('cuts at the first `?` even for non-URL strings', () => {
    expect(sanitizeReferer('not-a-url?leak=1&also=2')).toBe('not-a-url');
  });
});

describe('sanitizeUrl', () => {
  it('redacts the OAuth code while preserving the path and other params', () => {
    expect(sanitizeUrl('/api/auth/callback?code=secret-auth-code&provider=salesforce')).toBe(
      '/api/auth/callback?code=REDACTED&provider=salesforce',
    );
  });

  it('redacts the oauth-link data payload', () => {
    const url = '/oauth-link/?type=salesforce&data=%7B%22email%22%3A%22person%40frs.net%22%7D';
    expect(sanitizeUrl(url)).toBe('/oauth-link/?type=salesforce&data=REDACTED');
  });

  it('redacts every sensitive param present in one pass', () => {
    const sanitized = sanitizeUrl('/cb?state=abc&token=t&access_token=at&keep=1');
    expect(sanitized).toBe('/cb?state=REDACTED&token=REDACTED&access_token=REDACTED&keep=1');
  });

  it('returns the URL byte-for-byte when nothing sensitive is present', () => {
    // no re-encoding of untouched URLs — the original string is returned as-is
    const url = '/api/records?q=Account&fields=Id%2CName';
    expect(sanitizeUrl(url)).toBe(url);
  });

  it('returns the URL unchanged when there is no query string', () => {
    expect(sanitizeUrl('/api/auth/session')).toBe('/api/auth/session');
  });

  it('passes through nullish/empty values without throwing', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
    expect(sanitizeUrl('')).toBe('');
  });
});

describe('hashSessionId', () => {
  it('returns a stable, irreversible 16-char hash that is not the raw id', () => {
    const sessionId = 'AdrCGLHhS9zNNlqcjHMVJlm9dFI5inn2';
    const hashed = hashSessionId(sessionId);
    expect(hashed).toMatch(/^[0-9a-f]{16}$/);
    expect(hashed).not.toBe(sessionId);
    // deterministic so requests within one session still correlate
    expect(hashSessionId(sessionId)).toBe(hashed);
  });

  it('produces different hashes for different session ids', () => {
    expect(hashSessionId('session-a')).not.toBe(hashSessionId('session-b'));
  });

  it('passes through nullish/empty values without throwing', () => {
    expect(hashSessionId(undefined)).toBeUndefined();
    expect(hashSessionId('')).toBe('');
  });
});

describe('extractOrgUniqueId', () => {
  const orgUniqueId = '00DWC00000DRiVJ2A1-0053a00000Qp8LVAAZ';
  const buildOauthLinkUrl = (data: unknown) =>
    `/oauth-link/?type=salesforce&data=${encodeURIComponent(typeof data === 'string' ? data : JSON.stringify(data))}`;

  it('extracts the uniqueId from a valid oauth-link data payload', () => {
    expect(extractOrgUniqueId(buildOauthLinkUrl({ uniqueId: orgUniqueId, label: 'x' }))).toBe(orgUniqueId);
  });

  it('returns undefined for non-oauth-link URLs even if they carry a data param', () => {
    expect(extractOrgUniqueId(buildOauthLinkUrl({ uniqueId: orgUniqueId }).replace('/oauth-link/', '/api/session'))).toBeUndefined();
  });

  it('returns undefined when the data param is absent', () => {
    expect(extractOrgUniqueId('/oauth-link/?type=salesforce')).toBeUndefined();
  });

  it('returns undefined when uniqueId is missing from the payload', () => {
    expect(extractOrgUniqueId(buildOauthLinkUrl({ label: 'x' }))).toBeUndefined();
  });

  it('returns undefined (does not throw) on a malformed JSON payload', () => {
    expect(extractOrgUniqueId(buildOauthLinkUrl('{not-valid-json'))).toBeUndefined();
  });

  it('returns undefined after the data param has been redacted by sanitizeUrl', () => {
    // post-deploy reality: sanitizeUrl rewrites data to REDACTED, which is not valid JSON
    expect(extractOrgUniqueId('/oauth-link/?type=salesforce&data=REDACTED')).toBeUndefined();
  });

  it('passes through nullish/empty values without throwing', () => {
    expect(extractOrgUniqueId(undefined)).toBeUndefined();
    expect(extractOrgUniqueId('')).toBeUndefined();
  });
});
