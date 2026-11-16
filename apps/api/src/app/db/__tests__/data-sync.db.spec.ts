/**
 * Coverage for syncRecordChanges:
 *  - Routing matrix (create/update/delete vs. existing-record state).
 *  - INSERT ... ON CONFLICT DO UPDATE is the idempotent path used for creates;
 *    we assert against the unique-index columns (not a named constraint — the
 *    unique keys on this table are plain indexes).
 *  - All recordsToCreate get bundled into a single multi-row INSERT.
 *  - findByIdsIncludingOtherModifiedRecords is invoked with the union of touched
 *    record IDs plus any RETURNING ids from the upsert path, so concurrent
 *    pushes that lost the create race still see the winning row.
 *
 * Coverage for findByUpdatedAt:
 *  - Keyset pagination over (updatedAt, key) returns every record exactly once,
 *    even when keys do not sort in updatedAt order or a page ends mid-timestamp.
 */
import { ExistingSyncRow, resolveSyncOp } from '@jetstream/shared/utils';
import { addMinutes, addSeconds, subMinutes } from 'date-fns';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findByUpdatedAt, hashRecordSyncKey, MAX_PULL, MAX_SYNC, parseSyncOps, pullV2, syncRecordChanges, syncV2 } from '../data-sync.db';

const prismaMock = vi.hoisted(() => {
  // The existing-record lookup runs inside the transaction, so the transaction client shares the
  // top-level findMany mock - tests queue results in call order regardless of which client is used.
  const findMany = vi.fn();
  const findUniqueSyncState = vi.fn();
  const txClient = {
    userSyncData: {
      findMany,
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    userSyncState: { findUnique: findUniqueSyncState },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return {
    userSyncData: {
      findMany,
    },
    userSyncState: { findUnique: findUniqueSyncState },
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

function mockExistingRecords(
  rows: Array<{ id: string; key: string; updatedAt: Date; deletedAt: Date | null; clientUpdatedAt?: Date | null }>,
) {
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
    expect(staticSql).toContain(`ON CONFLICT ("userId", "hashedKey") DO UPDATE`);
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

type SyncRow = { id: string; userId: string; key: string; updatedAt: Date };
type WhereInput = Record<string, unknown>;
type OrderByInput = Array<Partial<Record<keyof SyncRow, 'asc' | 'desc'>>>;

function compareValues(left: unknown, right: unknown): number {
  const leftValue = left instanceof Date ? left.getTime() : (left as string | number);
  const rightValue = right instanceof Date ? right.getTime() : (right as string | number);
  if (leftValue === rightValue) {
    return 0;
  }
  return leftValue > rightValue ? 1 : -1;
}

/**
 * Minimal in-memory evaluator for the subset of Prisma's where clause used by findByUpdatedAt,
 * so pagination can be exercised across multiple pages without a database.
 */
function matchesWhere(row: SyncRow, where: WhereInput): boolean {
  return Object.entries(where).every(([field, condition]) => {
    if (field === 'OR') {
      return (condition as WhereInput[]).some((subCondition) => matchesWhere(row, subCondition));
    }
    const value = row[field as keyof SyncRow];
    if (condition instanceof Date || typeof condition !== 'object' || condition === null) {
      return compareValues(value, condition) === 0;
    }
    const { gt, ...unsupported } = condition as { gt?: unknown };
    if (gt === undefined || Object.keys(unsupported).length > 0) {
      throw new Error(`Unsupported filter on ${field}: ${JSON.stringify(condition)}`);
    }
    return compareValues(value, gt) > 0;
  });
}

function compareByOrderBy(left: SyncRow, right: SyncRow, orderBy: OrderByInput): number {
  for (const orderByField of orderBy) {
    const [[field, direction]] = Object.entries(orderByField) as Array<[keyof SyncRow, 'asc' | 'desc']>;
    const result = compareValues(left[field], right[field]);
    if (result !== 0) {
      return direction === 'asc' ? result : -result;
    }
  }
  return 0;
}

describe('findByUpdatedAt — keyset pagination', () => {
  const OTHER_USER_ID = '22222222-2222-2222-2222-222222222222';
  const BASE_DATE = new Date('2026-08-01T00:00:00Z');

  let rows: SyncRow[] = [];

  function makeRow(index: number, key: string, updatedAt: Date, userId = USER_ID): SyncRow {
    return { id: `id-${userId}-${index}`, userId, key, updatedAt };
  }

  /** Mirrors how a v1 client pulls: each response's cursor is sent with the next request */
  async function pullAll() {
    const pulledKeys: string[] = [];
    let updatedAt: Date | null = null;
    let lastKey: string | null = null;
    let hasMore = true;
    let requestCount = 0;
    while (hasMore) {
      if (requestCount > 20) {
        throw new Error('Pagination did not terminate');
      }
      const response = await findByUpdatedAt({ userId: USER_ID, updatedAt, lastKey, limit: MAX_PULL });
      pulledKeys.push(...response.records.map(({ key }) => key));
      hasMore = response.hasMore;
      updatedAt = response.updatedAt;
      lastKey = response.lastKey ?? null;
      requestCount++;
    }
    return { pulledKeys, requestCount };
  }

  beforeEach(() => {
    rows = [];
    prismaMock.userSyncData.findMany.mockImplementation(
      async ({ where, orderBy, take }: { where: WhereInput; orderBy: OrderByInput; take: number }) =>
        rows
          .filter((row) => matchesWhere(row, where))
          .sort((left, right) => compareByOrderBy(left, right, orderBy))
          .slice(0, take),
    );
  });

  afterEach(() => {
    prismaMock.userSyncData.findMany.mockReset();
  });

  it('keeps newer records whose key sorts before the last key of the previous page', async () => {
    // Query history keys are prefixed with the org id, so key order is unrelated to updatedAt.
    // The first page ends on an org B record, and every later record belongs to org A, whose keys sort lower.
    const olderRows = Array.from({ length: MAX_PULL }, (_, i) =>
      makeRow(i, `qh_org_b_${String(i).padStart(3, '0')}`, addSeconds(BASE_DATE, i)),
    );
    const newerRows = Array.from({ length: 50 }, (_, i) =>
      makeRow(MAX_PULL + i, `qh_org_a_${String(i).padStart(3, '0')}`, addSeconds(BASE_DATE, MAX_PULL + i)),
    );
    const otherUserRows = Array.from({ length: 5 }, (_, i) => makeRow(i, `qh_other_user_${i}`, addSeconds(BASE_DATE, i), OTHER_USER_ID));
    rows = [...olderRows, ...newerRows, ...otherUserRows];

    const { pulledKeys, requestCount } = await pullAll();

    expect(requestCount).toBe(2);
    expect(pulledKeys).toEqual([...olderRows, ...newerRows].map(({ key }) => key));
  });

  it('returns each record once when a page ends partway through records sharing one updatedAt', async () => {
    const sharedUpdatedAt = addSeconds(BASE_DATE, 80);
    rows = Array.from({ length: 130 }, (_, i) => {
      // Records 80-119 share one timestamp, so the first page ends inside that group
      const updatedAt = i >= 80 && i < 120 ? sharedUpdatedAt : addSeconds(BASE_DATE, i);
      // Reverse the key order so ties are not already in insertion order
      return makeRow(i, `qh_${String(999 - i).padStart(3, '0')}`, updatedAt);
    });

    const { pulledKeys, requestCount } = await pullAll();

    expect(requestCount).toBe(2);
    expect(pulledKeys).toHaveLength(rows.length);
    expect(new Set(pulledKeys)).toEqual(new Set(rows.map(({ key }) => key)));
  });

  it('treats an empty lastKey as a cursor when a page ends on it', async () => {
    // Records 99-129 share one timestamp; the empty key sorts first, so it is the last record of page 1
    const sharedUpdatedAt = addSeconds(BASE_DATE, 99);
    rows = Array.from({ length: 130 }, (_, i) => {
      if (i < 99) {
        return makeRow(i, `qh_${String(i).padStart(3, '0')}`, addSeconds(BASE_DATE, i));
      }
      return makeRow(i, i === 99 ? '' : `qh_${String(i).padStart(3, '0')}`, sharedUpdatedAt);
    });

    const { pulledKeys, requestCount } = await pullAll();

    expect(requestCount).toBe(2);
    expect(pulledKeys).toHaveLength(rows.length);
    expect(new Set(pulledKeys)).toEqual(new Set(rows.map(({ key }) => key)));
  });

  it('filters only by updatedAt when no lastKey is provided', async () => {
    const updatedAt = addSeconds(BASE_DATE, 10);

    await findByUpdatedAt({ userId: USER_ID, updatedAt, lastKey: null, limit: MAX_PULL });

    expect(prismaMock.userSyncData.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, updatedAt: { gt: updatedAt } } }),
    );
  });
});

describe('resolveSyncOp', () => {
  const NOW = new Date('2026-08-01T12:00:00Z');

  function makeOp(overrides: Partial<{ type: 'put' | 'delete'; clientUpdatedAt: Date; baseRevision: number | null }> = {}) {
    const base = {
      key: 'qh_key1',
      entity: 'query_history' as const,
      clientUpdatedAt: overrides.clientUpdatedAt ?? subMinutes(NOW, 5),
      baseRevision: overrides.baseRevision,
    };
    return overrides.type === 'delete'
      ? { ...base, type: 'delete' as const }
      : { ...base, type: 'put' as const, orgId: ORG_ID, data: { foo: 'bar' } };
  }

  function makeExisting(overrides: Partial<ExistingSyncRow> = {}): ExistingSyncRow {
    return {
      key: 'qh_key1',
      revision: 10,
      clientUpdatedAt: subMinutes(NOW, 10),
      updatedAt: subMinutes(NOW, 10),
      deletedAt: null,
      ...overrides,
    };
  }

  it('writes when the server has never seen the record', () => {
    const op = makeOp();
    expect(resolveSyncOp(op, undefined, NOW)).toEqual({ action: 'write', clientUpdatedAt: op.clientUpdatedAt });
  });

  it('accepts an edit based on the current revision even when the client clock is far behind', () => {
    // Device clock is an hour slow, but it edited the exact version the server holds - no conflict
    const op = makeOp({ clientUpdatedAt: subMinutes(NOW, 70), baseRevision: 10 });
    const existing = makeExisting();
    const decision = resolveSyncOp(op, existing, NOW);
    // The stored edit time must not move backwards, or an older edit from another device could win later
    expect(decision).toEqual({ action: 'write', clientUpdatedAt: existing.clientUpdatedAt });
  });

  it('rejects a stale-based edit that is older than the server version', () => {
    const op = makeOp({ clientUpdatedAt: subMinutes(NOW, 30), baseRevision: 7 });
    expect(resolveSyncOp(op, makeExisting(), NOW)).toEqual({ action: 'reject' });
  });

  it('accepts a stale-based edit that is newer than the server version', () => {
    const op = makeOp({ clientUpdatedAt: subMinutes(NOW, 1), baseRevision: 7 });
    expect(resolveSyncOp(op, makeExisting(), NOW)).toEqual({ action: 'write', clientUpdatedAt: op.clientUpdatedAt });
  });

  it('accepts a tie so that re-sending the same change is idempotent', () => {
    const existing = makeExisting();
    const op = makeOp({ clientUpdatedAt: existing.clientUpdatedAt as Date, baseRevision: null });
    expect(resolveSyncOp(op, existing, NOW).action).toBe('write');
  });

  it('clamps a client clock that is running ahead to the server time', () => {
    const op = makeOp({ clientUpdatedAt: addMinutes(NOW, 600) });
    expect(resolveSyncOp(op, undefined, NOW)).toEqual({ action: 'write', clientUpdatedAt: NOW });
  });

  it('un-deletes when the edit is newer than the tombstone and keeps the tombstone otherwise', () => {
    const tombstone = makeExisting({ deletedAt: subMinutes(NOW, 10) });
    expect(resolveSyncOp(makeOp({ clientUpdatedAt: subMinutes(NOW, 2) }), tombstone, NOW).action).toBe('write');
    expect(resolveSyncOp(makeOp({ clientUpdatedAt: subMinutes(NOW, 20) }), tombstone, NOW).action).toBe('reject');
  });

  it('rejects a delete that is older than an edit made on another device', () => {
    const op = makeOp({ type: 'delete', clientUpdatedAt: subMinutes(NOW, 30), baseRevision: 7 });
    expect(resolveSyncOp(op, makeExisting(), NOW)).toEqual({ action: 'reject' });
  });

  it('treats deleting an existing tombstone as already done', () => {
    const tombstone = makeExisting({ deletedAt: subMinutes(NOW, 10) });
    expect(resolveSyncOp(makeOp({ type: 'delete' }), tombstone, NOW)).toEqual({ action: 'noop', revision: 10 });
  });

  it('falls back to the server write time for rows that have no client edit time', () => {
    const existing = makeExisting({ clientUpdatedAt: null, updatedAt: subMinutes(NOW, 10) });
    expect(resolveSyncOp(makeOp({ clientUpdatedAt: subMinutes(NOW, 20) }), existing, NOW).action).toBe('reject');
    expect(resolveSyncOp(makeOp({ clientUpdatedAt: subMinutes(NOW, 5) }), existing, NOW).action).toBe('write');
  });
});

describe('parseSyncOps', () => {
  const validOp = { type: 'put', key: 'qh_a', entity: 'query_history', clientUpdatedAt: '2026-08-01T00:00:00.000Z', data: { soql: 'x' } };

  it('reports a bad op as invalid without affecting the others', () => {
    const parsed = parseSyncOps([validOp, { type: 'put', key: 'qh_b' }, { ...validOp, key: 'qh_c', entity: 'not_a_thing' }]);
    expect(parsed.map(({ valid }) => valid)).toEqual([true, false, false]);
  });

  it('reports a key repeated in the request as invalid', () => {
    const parsed = parseSyncOps([validOp, { ...validOp, type: 'delete' }]);
    expect(parsed.map(({ valid }) => valid)).toEqual([true, false]);
  });

  it('rejects reserved object keys', () => {
    expect(parseSyncOps([{ ...validOp, key: '__proto__' }])[0].valid).toBe(false);
  });

  it('reports strings Postgres cannot store as invalid instead of letting them fail the whole insert', () => {
    const parsed = parseSyncOps([
      validOp,
      { ...validOp, key: 'qh_nul\u0000key' },
      { ...validOp, key: 'qh_nul_value', data: { soql: 'a\u0000b' } },
      { ...validOp, key: 'qh_nul_prop', data: { nested: [{ 'bad\u0000prop': 1 }] } },
      { ...validOp, key: 'qh_lone_surrogate', data: { soql: 'a\ud800b' } },
      { ...validOp, key: 'qh_emoji', data: { soql: 'valid pair \ud83d\ude00' } },
    ]);
    expect(parsed.map(({ valid }) => valid)).toEqual([true, false, false, false, false, true]);
  });
});

describe('syncV2', () => {
  const validOp = { type: 'put', key: 'qh_a', entity: 'query_history', clientUpdatedAt: '2026-08-01T00:00:00.000Z', data: { soql: 'x' } };

  beforeEach(() => {
    prismaMock.userSyncData.findMany.mockReset();
    prismaMock.userSyncState.findUnique.mockReset();
  });

  it('asks the client to reset when its cursor is ahead of the server', async () => {
    prismaMock.userSyncState.findUnique.mockResolvedValue({ revision: BigInt(5) });

    const response = await syncV2({ userId: USER_ID, cursor: 9, ops: [validOp] });

    expect(response).toEqual({ results: [], changes: [], cursor: 5, hasMore: false, resetRequired: true });
    expect(prismaMock.__tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('locks the user before reading, writes accepted ops in one statement and reports per-op results', async () => {
    prismaMock.userSyncState.findUnique.mockResolvedValueOnce({ revision: BigInt(20) }).mockResolvedValueOnce({ revision: BigInt(22) });
    prismaMock.userSyncData.findMany
      // existing rows for the ops
      .mockResolvedValueOnce([
        {
          key: 'qh_stale',
          hashedKey: hashRecordSyncKey('qh_stale'),
          revision: BigInt(15),
          clientUpdatedAt: new Date('2026-09-01T00:00:00Z'),
          updatedAt: new Date('2026-09-01T00:00:00Z'),
          deletedAt: null,
        },
      ])
      // full row for the rejected op
      .mockResolvedValueOnce([
        {
          key: 'qh_stale',
          hashedKey: hashRecordSyncKey('qh_stale'),
          entity: 'query_history',
          orgId: ORG_ID,
          data: { soql: 'server' },
          revision: BigInt(15),
          clientUpdatedAt: new Date('2026-09-01T00:00:00Z'),
          deletedAt: null,
        },
      ])
      // changes from other clients since the cursor
      .mockResolvedValueOnce([]);
    prismaMock.__tx.$queryRaw.mockResolvedValue([{ hashedKey: hashRecordSyncKey('qh_a'), revision: BigInt(22) }]);

    const response = await syncV2({
      userId: USER_ID,
      cursor: 20,
      ops: [validOp, { ...validOp, key: 'qh_stale', baseRevision: 3 }, { type: 'put', key: 'qh_bad' }],
    });

    expect(prismaMock.__tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      prismaMock.userSyncData.findMany.mock.invocationCallOrder[0],
    );
    expect(prismaMock.__tx.$queryRaw).toHaveBeenCalledOnce();
    const { staticSql } = getQueryRawCall();
    expect(staticSql).toMatch(/ON CONFLICT \("userId", "hashedKey"\) DO UPDATE/);

    expect(response.results[0]).toEqual({ status: 'accepted', revision: 22 });
    expect(response.results[1]).toMatchObject({ status: 'rejected', record: { key: 'qh_stale', revision: 15, data: { soql: 'server' } } });
    expect(response.results[2].status).toBe('invalid');
    expect(response).toMatchObject({ cursor: 22, hasMore: false, resetRequired: false });
  });
});

describe('pullV2 — revision pagination', () => {
  interface RevisionRow {
    key: string;
    revision: bigint;
    deletedAt: Date | null;
  }
  let rows: RevisionRow[] = [];

  beforeEach(() => {
    prismaMock.userSyncState.findUnique.mockReset();
    prismaMock.userSyncData.findMany.mockReset();
    prismaMock.userSyncData.findMany.mockImplementation(
      async ({ where, take }: { where: { revision: { gt: bigint; lte: bigint } }; take: number }) =>
        rows
          .filter(({ revision }) => revision > where.revision.gt && revision <= where.revision.lte)
          .sort((left, right) => Number(left.revision - right.revision))
          .slice(0, take)
          .map((row) => ({ ...row, entity: 'query_history', orgId: ORG_ID, data: { soql: row.key }, clientUpdatedAt: null })),
    );
  });

  afterEach(() => {
    prismaMock.userSyncData.findMany.mockReset();
  });

  it('returns every record exactly once across pages and ends on the user revision', async () => {
    // Revisions have gaps (an upsert that updates consumes two), which must not matter
    rows = Array.from({ length: 450 }, (_, i) => ({ key: `qh_${i}`, revision: BigInt(i * 2 + 1), deletedAt: null }));
    prismaMock.userSyncState.findUnique.mockResolvedValue({ revision: BigInt(1000) });

    const pulledKeys: string[] = [];
    let cursor = 0;
    let hasMore = true;
    let requestCount = 0;
    while (hasMore) {
      const response = await pullV2({ userId: USER_ID, cursor, limit: 200 });
      pulledKeys.push(...response.changes.map(({ key }) => key));
      ({ cursor, hasMore } = response);
      requestCount++;
    }

    expect(requestCount).toBe(3);
    expect(pulledKeys).toEqual(rows.map(({ key }) => key));
    expect(cursor).toBe(1000);
  });

  it('never returns rows above the counter value read before the query', async () => {
    // A row committed after the counter was read must wait for the next pull instead of being
    // returned alongside a cursor that does not cover it.
    rows = [
      { key: 'qh_1', revision: BigInt(1), deletedAt: null },
      { key: 'qh_2', revision: BigInt(2), deletedAt: null },
    ];
    prismaMock.userSyncState.findUnique.mockResolvedValue({ revision: BigInt(1) });

    const response = await pullV2({ userId: USER_ID, cursor: 0, limit: 200 });

    expect(response.changes.map(({ key }) => key)).toEqual(['qh_1']);
    expect(response.cursor).toBe(1);
  });

  it('strips the payload from tombstones and flags a cursor that is ahead of the server', async () => {
    rows = [{ key: 'qh_1', revision: BigInt(1), deletedAt: new Date() }];
    prismaMock.userSyncState.findUnique.mockResolvedValue({ revision: BigInt(1) });

    const response = await pullV2({ userId: USER_ID, cursor: 0, limit: 200 });
    expect(response.changes[0]).toMatchObject({ key: 'qh_1', deleted: true, data: {} });

    expect((await pullV2({ userId: USER_ID, cursor: 50, limit: 200 })).resetRequired).toBe(true);
  });
});
