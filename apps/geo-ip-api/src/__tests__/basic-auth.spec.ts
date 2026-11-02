import { describe, expect, it } from 'vitest';
import { hasValidBasicAuthCredentials } from '../basic-auth';

function basicHeader(credentials: string) {
  return `Basic ${Buffer.from(credentials).toString('base64')}`;
}

describe('hasValidBasicAuthCredentials', () => {
  it('accepts the expected credentials', () => {
    expect(hasValidBasicAuthCredentials(basicHeader('geo:secret'), 'geo', 'secret')).toBe(true);
  });

  it('allows a colon in the password', () => {
    expect(hasValidBasicAuthCredentials(basicHeader('geo:se:cret'), 'geo', 'se:cret')).toBe(true);
  });

  it('rejects a wrong username or password', () => {
    expect(hasValidBasicAuthCredentials(basicHeader('geo:wrong'), 'geo', 'secret')).toBe(false);
    expect(hasValidBasicAuthCredentials(basicHeader('other:secret'), 'geo', 'secret')).toBe(false);
  });

  it('rejects a missing or malformed header', () => {
    expect(hasValidBasicAuthCredentials(undefined, 'geo', 'secret')).toBe(false);
    expect(hasValidBasicAuthCredentials('Bearer abc', 'geo', 'secret')).toBe(false);
    expect(hasValidBasicAuthCredentials('Basic', 'geo', 'secret')).toBe(false);
  });

  it('fails closed when the expected credentials are not configured', () => {
    expect(hasValidBasicAuthCredentials(basicHeader(':'), '', '')).toBe(false);
    expect(hasValidBasicAuthCredentials(basicHeader(':'), undefined, undefined)).toBe(false);
  });
});
