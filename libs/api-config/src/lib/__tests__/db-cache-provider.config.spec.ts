import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => {
  const mock: any = {
    cacheEntry: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      upsert: vi.fn(),
    },
    // Interactive transaction: invoke the callback with the same mock so nested
    // tx.cacheEntry.* calls hit the same spies the tests assert against.
    $transaction: vi.fn((callback: (tx: any) => Promise<unknown>) => callback(mock)),
  };
  return mock;
});

// Minimal Prisma.PrismaClientKnownRequestError stand-in so the instanceof check in
// consumeOnceAsync can match what the mocked create() rejects with. Hoisted so
// vi.mock can reference the class safely — top-level consts are hoisted after mocks.
const PrismaClientKnownRequestErrorMock = vi.hoisted(() => {
  return class PrismaClientKnownRequestErrorMock extends Error {
    code: string;
    constructor(message: string, code: string) {
      super(message);
      this.code = code;
    }
  };
});

vi.mock('../api-db-config', () => ({ prisma: prismaMock }));
vi.mock('@jetstream/prisma', () => ({
  Prisma: {
    PrismaClientKnownRequestError: PrismaClientKnownRequestErrorMock,
  },
}));

import { DbCacheProvider } from '../db-cache-provider.config';

describe('DbCacheProvider.consumeOnceAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.cacheEntry.deleteMany.mockResolvedValue({ count: 0 });
  });

  it('returns true when the key has not been consumed yet (INSERT succeeds)', async () => {
    prismaMock.cacheEntry.create.mockResolvedValueOnce({});
    const provider = new DbCacheProvider('saml:test', 60_000);

    const result = await provider.consumeOnceAsync('assertion-id-1');

    expect(result).toBe(true);
    expect(prismaMock.cacheEntry.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'saml:test:assertion-id-1',
        value: '1',
      }),
    });
  });

  it('reclaims an expired row for the same key so a stale marker does not block a new first use', async () => {
    prismaMock.cacheEntry.deleteMany.mockResolvedValueOnce({ count: 1 });
    prismaMock.cacheEntry.create.mockResolvedValueOnce({});
    const provider = new DbCacheProvider('saml:test', 60_000);

    const result = await provider.consumeOnceAsync('assertion-id-1');

    expect(result).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    const deleteCall = prismaMock.cacheEntry.deleteMany.mock.calls[0][0];
    expect(deleteCall.where.key).toBe('saml:test:assertion-id-1');
    expect(deleteCall.where.expiresAt).toEqual({ lt: expect.any(Date) });
    expect(prismaMock.cacheEntry.create).toHaveBeenCalled();
  });

  it('returns false when the key is already present (P2002 unique-key violation)', async () => {
    prismaMock.cacheEntry.create.mockRejectedValueOnce(
      new PrismaClientKnownRequestErrorMock('Unique constraint failed on the fields: (`key`)', 'P2002'),
    );
    const provider = new DbCacheProvider('saml:test', 60_000);

    const result = await provider.consumeOnceAsync('assertion-id-1');

    expect(result).toBe(false);
  });

  it('namespaces the key so two providers do not collide on the same id', async () => {
    prismaMock.cacheEntry.create.mockResolvedValue({});
    const providerA = new DbCacheProvider('saml:consumed-assertion', 60_000);
    const providerB = new DbCacheProvider('saml:authn-request', 60_000);

    await providerA.consumeOnceAsync('shared-id');
    await providerB.consumeOnceAsync('shared-id');

    const firstCall = prismaMock.cacheEntry.create.mock.calls[0][0];
    const secondCall = prismaMock.cacheEntry.create.mock.calls[1][0];
    expect(firstCall.data.key).toBe('saml:consumed-assertion:shared-id');
    expect(secondCall.data.key).toBe('saml:authn-request:shared-id');
  });

  it('rethrows non-P2002 errors so unexpected failures are not silently treated as replays', async () => {
    const unexpected = new PrismaClientKnownRequestErrorMock('connection lost', 'P1001');
    prismaMock.cacheEntry.create.mockRejectedValueOnce(unexpected);
    const provider = new DbCacheProvider('saml:test', 60_000);

    await expect(provider.consumeOnceAsync('assertion-id-1')).rejects.toBe(unexpected);
  });

  it('writes an expiration derived from ttlMs so stale entries are cleaned up lazily', async () => {
    prismaMock.cacheEntry.create.mockResolvedValueOnce({});
    const provider = new DbCacheProvider('saml:test', 5 * 60_000);

    const before = Date.now();
    await provider.consumeOnceAsync('assertion-id-1');
    const after = Date.now();

    const { createdAt, expiresAt } = prismaMock.cacheEntry.create.mock.calls[0][0].data;
    expect(createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(createdAt.getTime()).toBeLessThanOrEqual(after);
    expect(expiresAt.getTime() - createdAt.getTime()).toBe(5 * 60_000);
  });
});
