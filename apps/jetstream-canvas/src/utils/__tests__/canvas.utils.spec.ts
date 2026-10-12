import { describe, expect, it } from 'vitest';
import { deriveCanvasScopeId, extractSandboxName, parseCanvasAccessPolicy } from '../canvas.utils';

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

describe('parseCanvasAccessPolicy', () => {
  it('returns full access when the parameter is missing, as older package versions do not send it', () => {
    expect(parseCanvasAccessPolicy(undefined)).toBeNull();
  });

  it('returns full access for users without Limited Access', () => {
    expect(parseCanvasAccessPolicy(null)).toBeNull();
    // The whole parameter bag may arrive as JSON text, which turns the Apex null into the string "null"
    expect(parseCanvasAccessPolicy('null')).toBeNull();
  });

  it('only allows the tools and operations Salesforce granted, plus connecting orgs', () => {
    expect(parseCanvasAccessPolicy({ tools: ['query', 'data-analysis'], operations: ['records.export'] })).toEqual({
      tools: ['query', 'data-analysis'],
      operations: ['records.export', 'orgs.connect'],
    });
  });

  it('allows nothing but connecting orgs when Limited Access is the only permission', () => {
    expect(parseCanvasAccessPolicy({ tools: [], operations: [] })).toEqual({ tools: [], operations: ['orgs.connect'] });
  });

  it('drops keys it does not recognize', () => {
    expect(parseCanvasAccessPolicy({ tools: ['query', 'some-future-tool'], operations: ['records.purge'] })).toEqual({
      tools: ['query'],
      operations: ['orgs.connect'],
    });
  });

  it('reads a policy sent as JSON text', () => {
    expect(parseCanvasAccessPolicy(JSON.stringify({ tools: ['load'], operations: ['records.write'] }))).toEqual({
      tools: ['load'],
      operations: ['records.write', 'orgs.connect'],
    });
  });

  it('fails closed when the policy cannot be read', () => {
    const noAccess = { tools: [], operations: ['orgs.connect'] };
    expect(parseCanvasAccessPolicy('not json')).toEqual(noAccess);
    expect(parseCanvasAccessPolicy(true)).toEqual(noAccess);
    expect(parseCanvasAccessPolicy(['query'])).toEqual(noAccess);
    expect(parseCanvasAccessPolicy({ tools: 'query', operations: null })).toEqual(noAccess);
  });
});
