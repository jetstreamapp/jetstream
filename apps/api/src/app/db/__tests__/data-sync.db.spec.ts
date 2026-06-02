/**
 * Coverage for syncRecordChanges:
 *  - Routing matrix (create/update/delete vs. existing-record state).
 *  - INSERT ... ON CONFLICT DO UPDATE is the idempotent path used for creates;
 *    we assert against the unique-index columns (not a named constraint, which
 *    does not exist for user_hashed_key_org — see migration 20250208000003).
 *  - All recordsToCreate get bundled into a single multi-row INSERT.
 *  - findByIdsIncludingOtherModifiedRecords is invoked with the union of touched
 *    record IDs plus any RETURNING ids from the upsert path, so concurrent
 *    pushes that lost the create race still see the winning row.
 */
import { addMinutes, subMinutes } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_SYNC, syncRecordChanges } from '../data-sync.db';

const prismaMock = vi.hoisted(() => {
  const txClient = {
    userSyncData: {
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  return {
    userSyncData: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: typeof txClient) => Promise<unknown>) => callback(txClient)),
    __tx: txClient,
  };
});

// $queryRaw is invoked as a tagged template literal:
//   tx.$queryRaw`INSERT ... VALUES ${Prisma.join(values)} ...`
// The mock therefore captures `(templateStrings, ...interpolatedValues)`. We
// reconstruct the static SQL by joining the template parts; interpolated Sql
// instances (from Prisma.sql/Prisma.join) carry their parameter values via .values.
function getQueryRawCall(callIdx = 0) {
  const args = prismaMock.__tx.$queryRaw.mock.calls[callIdx];
  expect(args, `expected $queryRaw call #${callIdx}`).toBeDefined();
  const [templateStrings, ...interpolated] = args;
  const staticSql = (templateStrings as readonly string[]).join('?');
  return { staticSql, interpolated };
}

vi.mock('@jetstream/api-config', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  prisma: prismaMock,
}));

const USER_ID = '11111111-1111-1111-1111-111111111111';
const ORG_ID = 'org-1';

function makeCreate(
  overrides: Partial<{
    key: string;
    hashedKey: string;
    orgId: string | null;
    updatedAt: Date;
    createdAt: Date;
    data: Record<string, unknown>;
  }> = {},
) {
  const now = new Date('2026-05-10T12:00:00Z');
  return {
    type: 'create' as const,
    key: overrides.key ?? 'qh_key1',
    hashedKey: overrides.hashedKey ?? 'hash1',
    entity: 'query_history' as const,
    orgId: overrides.orgId === undefined ? ORG_ID : overrides.orgId,
    data: overrides.data ?? { foo: 'bar' },
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function makeUpdate(overrides: Partial<{ key: string; hashedKey: string; orgId: string | null; updatedAt: Date; createdAt: Date }> = {}) {
  return { ...makeCreate(overrides), type: 'update' as const };
}

function makeDelete(overrides: Partial<{ key: string; hashedKey: string; deletedAt: Date }> = {}) {
  return {
    type: 'delete' as const,
    key: overrides.key ?? 'qh_key1',
    hashedKey: overrides.hashedKey ?? 'hash1',
    entity: 'query_history' as const,
    data: {},
    deletedAt: overrides.deletedAt ?? new Date('2026-05-10T12:00:00Z'),
  };
}

function mockExistingRecords(rows: Array<{ id: string; key: string; updatedAt: Date; deletedAt: Date | null }>) {
  // First call: lookup of existing records by hashedKey (data-sync.db.ts:180-186)
  // Second call: findByIdsIncludingOtherModifiedRecords returns the post-write view (line 325)
  prismaMock.userSyncData.findMany.mockResolvedValueOnce(rows).mockResolvedValueOnce([]);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock.__tx));
  // Default: queryRaw returns one synthetic id per row in VALUES (see SQL template
  // — RETURNING id). Tests that care about specific ids override this.
  prismaMock.__tx.$queryRaw.mockResolvedValue([{ id: 'inserted-id-1' }]);
});

describe('syncRecordChanges — input validation', () => {
  it('rejects payloads larger than MAX_SYNC without touching the database', async () => {
    const records = Array.from({ length: MAX_SYNC + 1 }, (_, idx) => makeCreate({ key: `qh_${idx}`, hashedKey: `h_${idx}` }));

    await expect(syncRecordChanges({ userId: USER_ID, records, updatedAt: null, includeAllIfUpdatedAtNull: false })).rejects.toThrow(
      /Cannot sync more than/,
    );

    expect(prismaMock.userSyncData.findMany).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});

describe('syncRecordChanges — create routing', () => {
  it('routes a brand-new create through the INSERT ... ON CONFLICT path using the unique-index columns', async () => {
    mockExistingRecords([]);
    prismaMock.__tx.$queryRaw.mockResolvedValueOnce([{ id: 'new-id-1' }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate({ key: 'qh_new', hashedKey: 'hash_new' })],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledOnce();
    const { staticSql } = getQueryRawCall();
    expect(staticSql).toContain('INSERT INTO user_sync_data');
    // Index-based conflict target — a named-constraint reference (e.g. ON CONFLICT
    // ON CONSTRAINT user_hashed_key_org) would error at runtime because the migration
    // only created a unique index, not a constraint.
    expect(staticSql).toContain('ON CONFLICT ("userId", "hashedKey", "orgId")');
    expect(staticSql).not.toContain('ON CONSTRAINT');
    expect(staticSql).toContain('DO UPDATE');
    expect(staticSql).toContain('EXCLUDED."data"');
    expect(staticSql).toContain('"deletedAt" = NULL');
    expect(staticSql).toContain('RETURNING "id"');
  });

  it('batches multiple creates into a single multi-row INSERT (not N round-trips)', async () => {
    mockExistingRecords([]);
    prismaMock.__tx.$queryRaw.mockResolvedValueOnce([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);

    const records = [
      makeCreate({ key: 'qh_1', hashedKey: 'h1' }),
      makeCreate({ key: 'qh_2', hashedKey: 'h2' }),
      makeCreate({ key: 'qh_3', hashedKey: 'h3' }),
    ];

    await syncRecordChanges({ userId: USER_ID, records, updatedAt: null, includeAllIfUpdatedAtNull: false });

    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledOnce();
    const { interpolated } = getQueryRawCall();
    // Prisma.join wraps all per-record VALUES tuples into one Sql; its .values
    // array carries every parameter from every row. Presence of all three
    // hashedKey values proves the rows were emitted into one statement.
    const joinedSql = interpolated[0] as { values: unknown[] };
    expect(joinedSql.values).toEqual(expect.arrayContaining(['h1', 'h2', 'h3']));

    expect(prismaMock.userSyncData.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: expect.arrayContaining(['a', 'b', 'c']) } }) }),
    );
  });

  it('promotes a create to an UPDATE when the server already has the row with an older updatedAt', async () => {
    const olderUpdatedAt = subMinutes(new Date('2026-05-10T12:00:00Z'), 10);
    mockExistingRecords([{ id: 'existing-id', key: 'qh_key1', updatedAt: olderUpdatedAt, deletedAt: null }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.__tx.userSyncData.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, id: 'existing-id' }, data: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('ignores a create when the server holds a newer record (no write of any kind)', async () => {
    const newerUpdatedAt = addMinutes(new Date('2026-05-10T12:00:00Z'), 10);
    mockExistingRecords([{ id: 'existing-id', key: 'qh_key1', updatedAt: newerUpdatedAt, deletedAt: null }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.__tx.userSyncData.update).not.toHaveBeenCalled();
    expect(prismaMock.__tx.userSyncData.updateMany).not.toHaveBeenCalled();
    // The existing id is still surfaced back to the caller so the client can reconcile.
    expect(prismaMock.userSyncData.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: expect.arrayContaining(['existing-id']) } }) }),
    );
  });

  it('un-deletes via UPDATE when create is newer than a prior soft-delete', async () => {
    const olderDeletedAt = subMinutes(new Date('2026-05-10T12:00:00Z'), 30);
    mockExistingRecords([{ id: 'existing-id', key: 'qh_key1', updatedAt: olderDeletedAt, deletedAt: olderDeletedAt }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.userSyncData.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, id: 'existing-id' }, data: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('does not let a reserved key (__proto__) corrupt the existing-record lookup map', async () => {
    // The existing-record lookup map is keyed by attacker-controlled `record.key`. If it were a
    // plain object, `existingRecordsById['__proto__']` would resolve to the inherited Object
    // prototype (a truthy object with no `id`), misrouting this create into an UPDATE with
    // `id: undefined` and aborting the transaction. With a null-prototype map the lookup is
    // `undefined`, so the record routes cleanly through the INSERT path.
    mockExistingRecords([]);
    prismaMock.__tx.$queryRaw.mockResolvedValueOnce([{ id: 'proto-id' }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate({ key: '__proto__', hashedKey: 'hash_proto' })],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledOnce();
    expect(prismaMock.__tx.userSyncData.update).not.toHaveBeenCalled();
  });

  it('ignores a create when the server already soft-deleted after the client createdAt', async () => {
    const newerDeletedAt = addMinutes(new Date('2026-05-10T12:00:00Z'), 30);
    mockExistingRecords([{ id: 'existing-id', key: 'qh_key1', updatedAt: newerDeletedAt, deletedAt: newerDeletedAt }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).not.toHaveBeenCalled();
    expect(prismaMock.__tx.userSyncData.update).not.toHaveBeenCalled();
  });
});

describe('syncRecordChanges — update routing', () => {
  it('falls back to INSERT ... ON CONFLICT when an update arrives for a record the server has never seen', async () => {
    mockExistingRecords([]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeUpdate()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledOnce();
    expect(prismaMock.__tx.userSyncData.update).not.toHaveBeenCalled();
  });

  it('ignores an update older than the server-side updatedAt', async () => {
    const newerUpdatedAt = addMinutes(new Date('2026-05-10T12:00:00Z'), 10);
    mockExistingRecords([{ id: 'existing-id', key: 'qh_key1', updatedAt: newerUpdatedAt, deletedAt: null }]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeUpdate()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.userSyncData.update).not.toHaveBeenCalled();
  });
});

describe('syncRecordChanges — delete routing', () => {
  it('soft-deletes existing rows in a single updateMany call', async () => {
    mockExistingRecords([
      { id: 'id-a', key: 'qh_key1', updatedAt: new Date('2026-05-10T11:00:00Z'), deletedAt: null },
      { id: 'id-b', key: 'qh_key2', updatedAt: new Date('2026-05-10T11:00:00Z'), deletedAt: null },
    ]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeDelete({ key: 'qh_key1', hashedKey: 'hash1' }), makeDelete({ key: 'qh_key2', hashedKey: 'hash2' })],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.userSyncData.updateMany).toHaveBeenCalledOnce();
    expect(prismaMock.__tx.userSyncData.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        where: { userId: USER_ID, id: { in: expect.arrayContaining(['id-a', 'id-b']) } },
      }),
    );
  });

  it('drops deletes for records the server never had (no row to update, no id to return)', async () => {
    mockExistingRecords([]);

    await syncRecordChanges({
      userId: USER_ID,
      records: [makeDelete()],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.userSyncData.updateMany).not.toHaveBeenCalled();
    expect(prismaMock.__tx.$queryRaw).not.toHaveBeenCalled();
  });
});

describe('syncRecordChanges — idempotent concurrent-push simulation', () => {
  it('a second push for the same key reuses the upsert path and returns the existing row id from RETURNING', async () => {
    // Simulate the race: at lookup time the second push sees no existing record
    // (the first push hasn't committed yet), so the router decides to CREATE.
    // In production the unique index would then refuse the duplicate INSERT and the
    // ON CONFLICT DO UPDATE branch would surface the existing row's id via RETURNING.
    mockExistingRecords([]);
    prismaMock.__tx.$queryRaw.mockResolvedValueOnce([{ id: 'winning-row-id' }]);

    const result = await syncRecordChanges({
      userId: USER_ID,
      records: [makeCreate({ key: 'qh_race', hashedKey: 'hash_race' })],
      updatedAt: null,
      includeAllIfUpdatedAtNull: false,
    });

    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledOnce();
    expect(prismaMock.userSyncData.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: expect.arrayContaining(['winning-row-id']) } }) }),
    );
    // syncRecordChanges resolves to the PullResponse from the second findMany call.
    expect(result).toEqual(expect.objectContaining({ records: expect.any(Array), hasMore: false }));
  });
});
