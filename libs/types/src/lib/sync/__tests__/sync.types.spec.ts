import { describe, expect, it } from 'vitest';
import { ClientDataExportEnvelopeSchema, SyncRecordOperationSchema } from '../sync.types';

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

describe('ClientDataExportEnvelopeSchema', () => {
  const emptyData = {
    query_history: [],
    load_saved_mapping: [],
    recent_history_item: [],
    api_request_history: [],
    apex_history: {},
    salesforce_api_history: {},
    deploy_history: [],
    recent_records: {},
  };

  const baseEnvelope = (overrides: Record<string, unknown> = {}) => ({
    version: 1,
    app: 'jetstream',
    exportedAt: '2026-06-30T00:00:00Z',
    data: emptyData,
    ...overrides,
  });

  const queryHistoryRecord = (overrides: Record<string, unknown> = {}) => ({
    key: 'qh_o:accountselectid',
    hashedKey: 'h',
    org: 'o',
    sObject: 'Account',
    label: 'Account',
    soql: 'SELECT Id FROM Account',
    runCount: 2,
    isTooling: false,
    isFavorite: true,
    lastRun: '2026-01-01T00:00:00Z',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  });

  it('revives ISO date strings to Date objects', () => {
    const result = ClientDataExportEnvelopeSchema.parse(baseEnvelope({ data: { ...emptyData, query_history: [queryHistoryRecord()] } }));
    const [record] = result.data.query_history;
    expect(record.lastRun).toBeInstanceOf(Date);
    expect(record.createdAt).toBeInstanceOf(Date);
    expect(record.updatedAt).toBeInstanceOf(Date);
    // Passthrough fields survive validation
    expect((record as any).soql).toBe('SELECT Id FROM Account');
  });

  it('defaults missing data sections to empty collections', () => {
    const result = ClientDataExportEnvelopeSchema.parse({ version: 1, app: 'jetstream', exportedAt: '2026-06-30T00:00:00Z', data: {} });
    expect(result.data.query_history).toEqual([]);
    expect(result.data.apex_history).toEqual({});
    expect(result.data.recent_records).toEqual({});
  });

  it('rejects a file that is not a Jetstream export', () => {
    expect(ClientDataExportEnvelopeSchema.safeParse(baseEnvelope({ app: 'something-else' })).success).toBe(false);
  });

  it('rejects an envelope with a non-numeric version', () => {
    expect(ClientDataExportEnvelopeSchema.safeParse(baseEnvelope({ version: 'one' })).success).toBe(false);
  });

  it('strips reserved keys nested inside passthrough fields', () => {
    // Build via JSON.parse so `__proto__` lands as an own key, matching how a file body is materialized.
    const record = JSON.parse(
      '{"key":"qh_o:x","org":"o","sObject":"Account","label":"Account","soql":"SELECT Id","runCount":1,"isTooling":false,"isFavorite":false,"hashedKey":"h","lastRun":"2026-01-01T00:00:00Z","createdAt":"2026-01-01T00:00:00Z","updatedAt":"2026-01-01T00:00:00Z","extra":{"__proto__":{"polluted":true},"keep":1}}',
    );
    const result = ClientDataExportEnvelopeSchema.safeParse(baseEnvelope({ data: { ...emptyData, query_history: [record] } }));

    expect(result.success).toBe(true);
    if (result.success) {
      // safeParse returns the whole envelope, so the records live under result.data.data.*
      const parsedExtra = (result.data.data.query_history[0] as any).extra;
      expect(Object.prototype.hasOwnProperty.call(parsedExtra, '__proto__')).toBe(false);
      expect(parsedExtra.keep).toBe(1);
    }
    expect(({} as any).polluted).toBeUndefined();
  });
});
