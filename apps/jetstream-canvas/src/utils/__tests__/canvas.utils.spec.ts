import { describe, expect, it } from 'vitest';
import { deriveCanvasScopeId, extractSandboxName } from '../canvas.utils';

describe('extractSandboxName', () => {
  it('extracts the sandbox name from a My Domain sandbox host', () => {
    expect(extractSandboxName('https://acme--uat.sandbox.my.salesforce.com')).toBe('uat');
  });

  it('extracts from a lightning sandbox host', () => {
    expect(extractSandboxName('https://acme--uat.sandbox.lightning.force.com')).toBe('uat');
  });

  it('returns null for a production My Domain host', () => {
    expect(extractSandboxName('https://acme.my.salesforce.com')).toBeNull();
  });

  it('returns null for empty/undefined input', () => {
    expect(extractSandboxName(undefined)).toBeNull();
    expect(extractSandboxName(null)).toBeNull();
    expect(extractSandboxName('')).toBeNull();
  });
});

describe('deriveCanvasScopeId', () => {
  it('strips the sandbox suffix to recover the production username', () => {
    expect(deriveCanvasScopeId({ username: 'alice@acme.com.uat', hostOrUrl: 'https://acme--uat.sandbox.my.salesforce.com' })).toBe(
      'alice@acme.com',
    );
  });

  it('matches the sandbox suffix case-insensitively', () => {
    expect(deriveCanvasScopeId({ username: 'alice@acme.com.UAT', hostOrUrl: 'https://acme--uat.sandbox.my.salesforce.com' })).toBe(
      'alice@acme.com',
    );
  });

  it('returns a production username unchanged', () => {
    expect(deriveCanvasScopeId({ username: 'alice@acme.com', hostOrUrl: 'https://acme.my.salesforce.com' })).toBe('alice@acme.com');
  });

  it('maps a user across production and multiple sandboxes to the same scope', () => {
    const prod = deriveCanvasScopeId({ username: 'alice@acme.com', hostOrUrl: 'https://acme.my.salesforce.com' });
    const uat = deriveCanvasScopeId({ username: 'alice@acme.com.uat', hostOrUrl: 'https://acme--uat.sandbox.my.salesforce.com' });
    const dev = deriveCanvasScopeId({ username: 'alice@acme.com.dev', hostOrUrl: 'https://acme--dev.sandbox.my.salesforce.com' });
    expect(uat).toBe(prod);
    expect(dev).toBe(prod);
  });

  it('keeps different users in the same sandbox isolated', () => {
    const alice = deriveCanvasScopeId({ username: 'alice@acme.com.uat', hostOrUrl: 'https://acme--uat.sandbox.my.salesforce.com' });
    const bob = deriveCanvasScopeId({ username: 'bob@acme.com.uat', hostOrUrl: 'https://acme--uat.sandbox.my.salesforce.com' });
    expect(alice).not.toBe(bob);
  });

  it('falls back to the full username when the username does not carry the sandbox suffix', () => {
    // e.g. an admin renamed the sandbox user — safe fallback keeps them isolated rather than mis-grouping
    expect(deriveCanvasScopeId({ username: 'alice@acme.com', hostOrUrl: 'https://acme--uat.sandbox.my.salesforce.com' })).toBe(
      'alice@acme.com',
    );
  });
});
