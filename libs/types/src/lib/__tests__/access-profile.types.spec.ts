/**
 * Stored policies are read leniently (a policy written by an older or newer release must still parse, and
 * anything unrecognized can only remove access), while requests are validated strictly so a typo is
 * rejected instead of silently dropped. Surface checks back server-side sign in enforcement, so anything
 * unreadable must deny rather than grant.
 */
import { describe, expect, it } from 'vitest';
import {
  ACCESS_PROFILE_POLICY_VERSION,
  AccessProfilePolicyRequestSchema,
  AccessProfilePolicySchema,
  FULL_ACCESS_POLICY,
  getAccessProfileFingerprint,
  getAccessProfilePolicyWarnings,
  isAccessProfileSurfaceAllowed,
} from '../access-profile.types';

describe('AccessProfilePolicySchema', () => {
  it('parses a valid policy unchanged', () => {
    const policy = { v: 1, tools: ['query', 'load'], operations: ['records.write'], surfaces: ['desktop'] };

    expect(AccessProfilePolicySchema.parse(policy)).toEqual(policy);
  });

  it('drops unknown tool, operation and surface keys', () => {
    const result = AccessProfilePolicySchema.parse({
      v: 1,
      tools: ['query', 'tool-from-a-future-release'],
      operations: ['records.write', 'records.teleport'],
      surfaces: ['desktop', 'smart-fridge'],
    });

    expect(result).toEqual({ v: 1, tools: ['query'], operations: ['records.write'], surfaces: ['desktop'] });
  });

  it('removes duplicate keys while keeping the first occurrence order', () => {
    const result = AccessProfilePolicySchema.parse({
      v: 1,
      tools: ['load', 'query', 'load', 'query'],
      operations: ['records.delete', 'records.delete'],
      surfaces: ['browser-extension', 'browser-extension'],
    });

    expect(result.tools).toEqual(['load', 'query']);
    expect(result.operations).toEqual(['records.delete']);
    expect(result.surfaces).toEqual(['browser-extension']);
  });

  it('drops malformed entries without discarding the rest of the list', () => {
    const result = AccessProfilePolicySchema.parse({ v: 1, tools: ['query', 42, null, { key: 'load' }], operations: [], surfaces: [] });

    expect(result.tools).toEqual(['query']);
  });

  it('turns non-array and missing values into an empty list', () => {
    const result = AccessProfilePolicySchema.parse({ v: 1, tools: 'query', operations: null, surfaces: { desktop: true } });

    expect(result).toEqual({ v: 1, tools: [], operations: [], surfaces: [] });
    expect(AccessProfilePolicySchema.parse({})).toEqual({ v: ACCESS_PROFILE_POLICY_VERSION, tools: [], operations: [], surfaces: [] });
  });

  it('grants nothing when the stored policy is not an object, instead of failing to parse', () => {
    const emptyPolicy = { v: ACCESS_PROFILE_POLICY_VERSION, tools: [], operations: [], surfaces: [] };

    expect(AccessProfilePolicySchema.parse('corrupt')).toEqual(emptyPolicy);
    expect(AccessProfilePolicySchema.parse(null)).toEqual(emptyPolicy);
    expect(AccessProfilePolicySchema.parse(['query'])).toEqual(emptyPolicy);
  });

  it('falls back to the current policy version when the stored version is unreadable', () => {
    expect(AccessProfilePolicySchema.parse({ v: 'one', tools: [], operations: [], surfaces: [] }).v).toBe(ACCESS_PROFILE_POLICY_VERSION);
    expect(AccessProfilePolicySchema.parse({ v: 1.5, tools: [], operations: [], surfaces: [] }).v).toBe(ACCESS_PROFILE_POLICY_VERSION);
  });

  it('strips unknown top-level properties', () => {
    const result = AccessProfilePolicySchema.parse({ v: 1, tools: [], operations: [], surfaces: [], isAdmin: true });

    expect(result).not.toHaveProperty('isAdmin');
  });
});

describe('AccessProfilePolicyRequestSchema', () => {
  const validRequest = { tools: ['query'], operations: ['records.export'], surfaces: ['desktop'] };

  it('accepts a request made of known keys', () => {
    expect(AccessProfilePolicyRequestSchema.parse(validRequest)).toEqual(validRequest);
  });

  it('removes duplicate keys', () => {
    const result = AccessProfilePolicyRequestSchema.parse({
      tools: ['query', 'query'],
      operations: ['records.export', 'records.export'],
      surfaces: ['desktop', 'desktop'],
    });

    expect(result).toEqual(validRequest);
  });

  it.each([
    ['tool', { ...validRequest, tools: ['query', 'qeury'] }],
    ['operation', { ...validRequest, operations: ['records.wirte'] }],
    ['surface', { ...validRequest, surfaces: ['mobile'] }],
  ])('rejects an unknown %s key instead of dropping it', (_kind, request) => {
    expect(AccessProfilePolicyRequestSchema.safeParse(request).success).toBe(false);
  });

  it.each([
    ['tools', { operations: [], surfaces: [] }],
    ['operations', { tools: [], surfaces: [] }],
    ['surfaces', { tools: [], operations: [] }],
  ])('rejects a request without %s', (_key, request) => {
    expect(AccessProfilePolicyRequestSchema.safeParse(request).success).toBe(false);
  });

  it('rejects non-array values', () => {
    expect(AccessProfilePolicyRequestSchema.safeParse({ ...validRequest, tools: 'query' }).success).toBe(false);
  });
});

describe('isAccessProfileSurfaceAllowed', () => {
  it('allows every surface for a member without a profile', () => {
    expect(isAccessProfileSurfaceAllowed(null, 'web')).toBe(true);
    expect(isAccessProfileSurfaceAllowed(null, 'desktop')).toBe(true);
    expect(isAccessProfileSurfaceAllowed(undefined, 'browser-extension')).toBe(true);
  });

  it('allows a surface the policy lists', () => {
    const policy = { v: 1, tools: [], operations: [], surfaces: ['desktop'] };

    expect(isAccessProfileSurfaceAllowed({ policy }, 'desktop')).toBe(true);
  });

  it('denies a surface the policy does not list', () => {
    const policy = { v: 1, tools: ['query'], operations: [], surfaces: ['desktop'] };

    expect(isAccessProfileSurfaceAllowed({ policy }, 'browser-extension')).toBe(false);
    expect(isAccessProfileSurfaceAllowed({ policy: { ...policy, surfaces: [] } }, 'desktop')).toBe(false);
  });

  it('denies when the stored policy cannot be read', () => {
    expect(isAccessProfileSurfaceAllowed({ policy: null }, 'desktop')).toBe(false);
    expect(isAccessProfileSurfaceAllowed({ policy: 'garbage' }, 'desktop')).toBe(false);
    expect(isAccessProfileSurfaceAllowed({ policy: 42 }, 'desktop')).toBe(false);
    expect(isAccessProfileSurfaceAllowed({ policy: { v: 1, surfaces: 'desktop' } }, 'desktop')).toBe(false);
  });
});

describe('getAccessProfilePolicyWarnings', () => {
  const { surfaces } = FULL_ACCESS_POLICY;

  it('returns no warnings for full access', () => {
    expect(getAccessProfilePolicyWarnings(FULL_ACCESS_POLICY)).toEqual([]);
  });

  it('returns no warnings for a read only profile without escape hatches', () => {
    expect(getAccessProfilePolicyWarnings({ tools: ['query', 'permission-analysis'], operations: [], surfaces })).toEqual([]);
  });

  it('flags an enabled tool whose required operation is off', () => {
    const warnings = getAccessProfilePolicyWarnings({ tools: ['query', 'load'], operations: ['records.export'], surfaces });

    expect(warnings).toEqual([
      {
        type: 'MISSING_REQUIRED_OPERATION',
        message: expect.stringContaining('Load Records is enabled, but "Create and update records" is not.'),
      },
    ]);
  });

  it('ignores missing operations for tools that are turned off', () => {
    expect(getAccessProfilePolicyWarnings({ tools: ['query'], operations: [], surfaces })).toEqual([]);
  });

  it('flags an escape hatch that can still perform the hidden operations', () => {
    const warnings = getAccessProfilePolicyWarnings({ tools: ['anonymous-apex'], operations: ['records.write'], surfaces });

    expect(warnings).toEqual([
      {
        type: 'ESCAPE_HATCH',
        message: expect.stringContaining('Anonymous Apex can still delete records, deploy metadata and change configuration'),
      },
    ]);
  });

  it('names every enabled escape hatch in a single warning', () => {
    const warnings = getAccessProfilePolicyWarnings({ tools: ['anonymous-apex', 'salesforce-api'], operations: [], surfaces });

    expect(warnings).toHaveLength(1);
    expect(warnings[0].type).toBe('ESCAPE_HATCH');
    expect(warnings[0].message).toContain('Anonymous Apex and Salesforce API can still');
  });

  it('does not flag an escape hatch when none of its bypassed operations are hidden', () => {
    const warnings = getAccessProfilePolicyWarnings({
      tools: ['salesforce-api'],
      operations: ['records.write', 'records.delete', 'metadata.deploy'],
      surfaces,
    });

    expect(warnings).toEqual([]);
  });

  it('reports missing operations and escape hatches together', () => {
    const warnings = getAccessProfilePolicyWarnings({ tools: ['create-fields', 'anonymous-apex'], operations: [], surfaces });

    expect(warnings.map(({ type }) => type)).toEqual(['MISSING_REQUIRED_OPERATION', 'ESCAPE_HATCH']);
  });

  it('flags a profile that enables no application', () => {
    const warnings = getAccessProfilePolicyWarnings({ tools: ['query'], operations: [], surfaces: [] });

    expect(warnings.map(({ type }) => type)).toEqual(['NO_SURFACES']);
  });
});

describe('getAccessProfileFingerprint', () => {
  it('returns a constant fingerprint for full access', () => {
    expect(getAccessProfileFingerprint(null)).toBe('FULL_ACCESS');
    expect(getAccessProfileFingerprint(undefined)).toBe('FULL_ACCESS');
  });

  it('combines the profile id and version', () => {
    expect(getAccessProfileFingerprint({ id: 'profile-1', version: 3 })).toBe('profile-1:3');
  });

  it('changes when the profile is edited or the member moves to another profile', () => {
    const original = getAccessProfileFingerprint({ id: 'profile-1', version: 1 });

    expect(getAccessProfileFingerprint({ id: 'profile-1', version: 2 })).not.toBe(original);
    expect(getAccessProfileFingerprint({ id: 'profile-2', version: 1 })).not.toBe(original);
    expect(getAccessProfileFingerprint(null)).not.toBe(original);
  });
});
