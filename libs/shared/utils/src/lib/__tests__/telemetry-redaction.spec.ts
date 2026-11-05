import { describe, expect, it } from 'vitest';
import { sanitizeUrlForTelemetry } from '../telemetry-redaction';

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
    expect(sanitizeUrlForTelemetry('not a url?token=1')).toBe('/not%20a%20url');
    // invalid host: falls back to cutting at the first delimiter
    expect(sanitizeUrlForTelemetry('http://[bad-host/path?token=1#x')).toBe('http://[bad-host/path');
  });
});
