import { describe, expect, it } from 'vitest';
import { SyncRecordOperationSchema } from '../sync.types';

/**
 * Security coverage for the sync record schema (prototype pollution):
 *  - The `key` is attacker-controlled and is used server-side to build plain-object lookup
 *    maps, so reserved names must be rejected with a validation error (surfaces as a 400).
 *  - The `data` payload is persisted to JSONB and re-broadcast to other clients, so a nested
 *    `__proto__`/`constructor`/`prototype` own key must be stripped at any depth.
 */
const baseCreate = (overrides: Record<string, unknown> = {}) => ({
  type: 'create' as const,
  key: 'qh_valid',
  hashedKey: 'hash1',
  entity: 'query_history' as const,
  orgId: 'org-1',
  data: { foo: 'bar' },
  createdAt: '2026-05-10T12:00:00Z',
  updatedAt: '2026-05-10T12:00:00Z',
  ...overrides,
});

describe('SyncRecordOperationSchema — reserved key rejection', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('rejects a record with a reserved key (%s)', (reservedKey) => {
    const result = SyncRecordOperationSchema.safeParse(baseCreate({ key: reservedKey }));
    expect(result.success).toBe(false);
  });

  it('accepts legitimate prefixed keys (qh_/lsm_/ri_/api_)', () => {
    for (const key of ['qh_x', 'lsm_x', 'ri_x:sobject', 'api_x']) {
      const result = SyncRecordOperationSchema.safeParse(baseCreate({ key }));
      expect(result.success, `expected key "${key}" to be accepted`).toBe(true);
    }
  });
});

describe('SyncRecordOperationSchema — data sanitization', () => {
  it('strips a nested __proto__ own key without polluting Object.prototype', () => {
    // Build the payload via JSON.parse so `__proto__` lands as an own (not inherited) key,
    // matching how an HTTP JSON body is materialized.
    const data = JSON.parse('{"__proto__":{"polluted":true},"nested":{"__proto__":{"polluted":true},"keep":1}}');

    const result = SyncRecordOperationSchema.safeParse(baseCreate({ data }));

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.prototype.hasOwnProperty.call(result.data.data, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call((result.data.data as any).nested, '__proto__')).toBe(false);
      expect((result.data.data as any).nested.keep).toBe(1);
    }
    expect(({} as any).polluted).toBeUndefined();
  });

  it('strips reserved keys inside arrays at any depth', () => {
    const data = JSON.parse('{"items":[{"__proto__":{"x":1},"name":"ok"}]}');

    const result = SyncRecordOperationSchema.safeParse(baseCreate({ data }));

    expect(result.success).toBe(true);
    if (result.success) {
      const [item] = (result.data.data as any).items;
      expect(Object.prototype.hasOwnProperty.call(item, '__proto__')).toBe(false);
      expect(item.name).toBe('ok');
    }
  });
});
