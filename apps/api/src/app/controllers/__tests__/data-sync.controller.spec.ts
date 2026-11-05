/**
 * Coverage for the data-sync push body schema shared by the web, desktop and browser-extension mounts:
 *  - the record-count cap is enforced on the raw array before per-record validation
 *  - the total serialized size cap is enforced on the raw array
 *  - a missing hashedKey is still backfilled for older clients
 */
import { MAX_SYNC_PUSH_LENGTH, MAX_SYNC_RECORD_DATA_LENGTH, MAX_SYNC_RECORDS_PER_PUSH } from '@jetstream/types';
import crypto from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SyncRecordOperationSchemaFillHashedKey } from '../data-sync.controller';

vi.mock('@jetstream/api-config', () => ({
  ENV: { ENVIRONMENT: 'test', CI: false },
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  getLogger: () => ({ trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  errorTracker: { error: vi.fn(), warn: vi.fn(), critical: vi.fn(), info: vi.fn() },
  prisma: {},
}));
vi.mock('@jetstream/prisma', () => ({ Prisma: {} }));
vi.mock('../../services/data-sync-broadcast.service', () => ({ emitRecordSyncEventsToOtherClients: vi.fn() }));
vi.mock('../../utils/response.handlers', () => ({ sendJson: vi.fn() }));

const makeRecord = (index: number, overrides: Record<string, unknown> = {}) => ({
  type: 'create',
  key: `qh_${index}`,
  entity: 'query_history',
  orgId: 'org-1',
  data: { soql: 'SELECT Id FROM Account' },
  createdAt: '2026-05-10T12:00:00Z',
  updatedAt: '2026-05-10T12:00:00Z',
  ...overrides,
});

describe('SyncRecordOperationSchemaFillHashedKey', () => {
  it('backfills hashedKey from the key for older clients', () => {
    const result = SyncRecordOperationSchemaFillHashedKey.safeParse([makeRecord(1)]);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data[0].hashedKey).toBe(crypto.createHash('SHA1').update('qh_1').digest('hex'));
    }
  });

  it('rejects more than MAX_SYNC_RECORDS_PER_PUSH records', () => {
    const records = Array.from({ length: MAX_SYNC_RECORDS_PER_PUSH + 1 }, (_, index) => makeRecord(index));

    const result = SyncRecordOperationSchemaFillHashedKey.safeParse(records);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain(`${MAX_SYNC_RECORDS_PER_PUSH}`);
    }
  });

  it('rejects a push whose total serialized size exceeds MAX_SYNC_PUSH_LENGTH', () => {
    const records = Array.from({ length: 11 }, (_, index) =>
      makeRecord(index, { data: { soql: 'x'.repeat(MAX_SYNC_RECORD_DATA_LENGTH - 100) } }),
    );
    expect(JSON.stringify(records).length).toBeGreaterThan(MAX_SYNC_PUSH_LENGTH);

    expect(SyncRecordOperationSchemaFillHashedKey.safeParse(records).success).toBe(false);
  });

  it('rejects a single record whose data exceeds MAX_SYNC_RECORD_DATA_LENGTH', () => {
    const record = makeRecord(1, { data: { soql: 'x'.repeat(MAX_SYNC_RECORD_DATA_LENGTH) } });

    // Per-record validation runs inside the transform, so the failure surfaces as a thrown ZodError
    // (createRoute uses .parse, which turns it into a 400 either way)
    expect(() => SyncRecordOperationSchemaFillHashedKey.parse([record])).toThrow(/maximum serialized size/);
  });
});
