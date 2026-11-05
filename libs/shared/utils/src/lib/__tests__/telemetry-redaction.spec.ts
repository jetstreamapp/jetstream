import { describe, expect, it } from 'vitest';
import { isSensitiveTelemetryKey, redactSensitiveTelemetryData, sanitizeUrlForTelemetry } from '../telemetry-redaction';

describe('sanitizeUrlForTelemetry', () => {
  it('drops the query string and fragment', () => {
    expect(sanitizeUrlForTelemetry('https://getjetstream.app/auth/password-reset/verify?email=a%40b.com&code=1234')).toBe(
      'https://getjetstream.app/auth/password-reset/verify',
    );
    expect(sanitizeUrlForTelemetry('https://getjetstream.app/app/teams/invite?teamId=1&token=abc#section')).toBe(
      'https://getjetstream.app/app/teams/invite',
    );
    expect(sanitizeUrlForTelemetry('https://getjetstream.app/oauth/callback?code=xyz&state=123')).toBe(
      'https://getjetstream.app/oauth/callback',
    );
  });

  it('keeps relative urls relative', () => {
    expect(sanitizeUrlForTelemetry('/app/query?soql=SELECT+Id')).toBe('/app/query');
    expect(sanitizeUrlForTelemetry('/app/home')).toBe('/app/home');
  });

  it('redacts secret-looking path segments', () => {
    expect(sanitizeUrlForTelemetry('/invitations/2f1c7b9e-8f5a-4c3d-9a1b-0c2d3e4f5a6b')).toBe('/invitations/:redacted');
    expect(sanitizeUrlForTelemetry('/verify/0123456789abcdef0123456789abcdef')).toBe('/verify/:redacted');
    expect(sanitizeUrlForTelemetry('/app/record/001Dn00000AbCdEfAB')).toBe('/app/record/:redacted');
    expect(sanitizeUrlForTelemetry('https://x.app/t/eyJhbGciOiJIUzI1NiJ9.abc123')).toBe('https://x.app/t/:redacted');
  });

  it('keeps human readable slugs even when they are long', () => {
    expect(sanitizeUrlForTelemetry('https://getjetstream.app/salesforce-inspector-alternative')).toBe(
      'https://getjetstream.app/salesforce-inspector-alternative',
    );
    expect(sanitizeUrlForTelemetry('/app/compare-salesforce-permissions/results')).toBe('/app/compare-salesforce-permissions/results');
  });

  it('handles empty and unparseable input', () => {
    expect(sanitizeUrlForTelemetry('')).toBe('');
    expect(sanitizeUrlForTelemetry(null)).toBe('');
    expect(sanitizeUrlForTelemetry(undefined)).toBe('');
    expect(sanitizeUrlForTelemetry('not a url?token=1')).toBe('not%20a%20url');
    expect(sanitizeUrlForTelemetry('QueryPage')).toBe('QueryPage');
    // invalid host: falls back to cutting at the first delimiter
    expect(sanitizeUrlForTelemetry('http://[bad-host/path?token=1#x')).toBe('http://[bad-host/path');
  });
});

describe('isSensitiveTelemetryKey', () => {
  it('matches secret-bearing keys regardless of casing or separators', () => {
    for (const key of [
      'token',
      'access_token',
      'refreshToken',
      'Authorization',
      'Cookie',
      'password',
      'client_secret',
      'code',
      'state',
      'csrf-token',
    ]) {
      expect(isSensitiveTelemetryKey(key), key).toBe(true);
    }
  });

  it('does not match ambiguous keys used as substrings', () => {
    for (const key of ['statusCode', 'stateName', 'osId', 'email', 'userId', 'query', 'sobject']) {
      expect(isSensitiveTelemetryKey(key), key).toBe(false);
    }
  });
});

describe('redactSensitiveTelemetryData', () => {
  it('redacts secret keys recursively and keeps the rest', () => {
    const input = {
      sobject: 'Account',
      token: 'abc',
      nested: { refresh_token: 'r', headers: { Authorization: 'Bearer x', 'content-type': 'json' }, state: 's' },
      list: [{ password: 'p', name: 'ok' }],
    };
    const result = redactSensitiveTelemetryData(input);
    expect(result).toEqual({
      sobject: 'Account',
      token: '[REDACTED]',
      nested: { refresh_token: '[REDACTED]', headers: { Authorization: '[REDACTED]', 'content-type': 'json' }, state: '[REDACTED]' },
      list: [{ password: '[REDACTED]', name: 'ok' }],
    });
    // input is not mutated
    expect(input.token).toBe('abc');
  });

  it('truncates long strings and arrays and cuts off deep nesting', () => {
    const longString = 'x'.repeat(50);
    const result = redactSensitiveTelemetryData(
      { query: longString, rows: Array.from({ length: 5 }, (_, i) => i), deep: { a: { b: { c: 'leaf' } } } },
      { maxStringLength: 10, maxArrayLength: 2, maxDepth: 3 },
    );
    expect(result.query).toBe('xxxxxxxxxx…[truncated 40 chars]');
    expect(result.rows).toEqual([0, 1, '…[truncated 3 items]']);
    expect(result.deep).toEqual({ a: { b: '[REDACTED]' } });
  });

  it('leaves primitives, special objects and circular references safe', () => {
    const date = new Date();
    const circular: Record<string, unknown> = { name: 'c' };
    circular.self = circular;
    expect(redactSensitiveTelemetryData(42)).toBe(42);
    expect(redactSensitiveTelemetryData(null)).toBe(null);
    expect(redactSensitiveTelemetryData({ date }).date).toBe(date);
    expect(redactSensitiveTelemetryData(circular)).toEqual({ name: 'c', self: '[Circular]' });
  });
});
