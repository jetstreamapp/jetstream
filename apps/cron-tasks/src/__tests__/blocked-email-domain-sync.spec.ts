import type { PrismaClient } from '@jetstream/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { syncBlockedEmailDomains } from '../utils/blocked-email-domain-sync.utils';

vi.mock('../config/logger.config', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../config/env-config', () => ({
  ENV: { BLOCKED_EMAIL_DOMAIN_LIST_URL: 'https://example.com/blocklist.conf' },
}));

/** The sync aborts below 5000 usable domains, so every fixture needs enough filler to clear that. */
function buildList(...domains: string[]) {
  const filler = Array.from({ length: 5200 }, (_, i) => `filler-${i}.example`);
  return ['// comment line', '', ...filler, ...domains].join('\n');
}

function mockPrisma(existingRows: { domain: string; source: 'MANUAL' | 'LIST_SYNC' }[] = []) {
  return {
    blockedEmailDomain: {
      findMany: vi.fn().mockResolvedValue(existingRows),
      createMany: vi.fn(({ data }: { data: { domain: string }[] }) => Promise.resolve({ count: data.length })),
      deleteMany: vi.fn(({ where }: { where: { domain: { in: string[] } } }) => Promise.resolve({ count: where.domain.in.length })),
      count: vi.fn().mockResolvedValue(0),
    },
  };
}

/** The mock only implements what the sync touches; keeping it untyped preserves the vi.fn() call records. */
const asPrismaClient = (mock: ReturnType<typeof mockPrisma>) => mock as unknown as PrismaClient;

const insertedDomains = (prisma: ReturnType<typeof mockPrisma>) =>
  prisma.blockedEmailDomain.createMany.mock.calls.flatMap(([{ data }]) => data.map(({ domain }) => domain));

function mockFetchResponse(body: string, ok = true, status = 200) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status, statusText: 'Error', text: () => Promise.resolve(body) }));
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.TEST_MODE;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncBlockedEmailDomains', () => {
  it('should insert domains that are not already stored', async () => {
    mockFetchResponse(buildList('burner.example'));
    const prisma = mockPrisma();

    const result = await syncBlockedEmailDomains(asPrismaClient(prisma));

    expect(result.added).toBe(5201);
    expect(result.removed).toBe(0);
    const inserted = prisma.blockedEmailDomain.createMany.mock.calls.flatMap(([{ data }]) => data);
    expect(inserted).toContainEqual({ domain: 'burner.example', blocked: true, source: 'LIST_SYNC' });
  });

  it('should skip comments and malformed entries', async () => {
    mockFetchResponse(buildList('# hash comment', 'not a domain', 'no-dot', 'valid.example'));
    const prisma = mockPrisma();

    const result = await syncBlockedEmailDomains(asPrismaClient(prisma));

    expect(result.skippedInvalid).toBe(2);
    expect(result.fetched).toBe(5201);
  });

  it('should leave the seeded forwarding-service allowlist rows alone when the upstream list includes them', async () => {
    mockFetchResponse(buildList('privaterelay.appleid.com', 'duck.com', 'burner.example'));
    const prisma = mockPrisma([
      { domain: 'privaterelay.appleid.com', source: 'MANUAL' },
      { domain: 'duck.com', source: 'MANUAL' },
    ]);

    await syncBlockedEmailDomains(asPrismaClient(prisma));

    const inserted = insertedDomains(prisma);
    expect(inserted).not.toContain('privaterelay.appleid.com');
    expect(inserted).not.toContain('duck.com');
    expect(prisma.blockedEmailDomain.deleteMany).not.toHaveBeenCalled();
  });

  it('should delete only LIST_SYNC rows that fell off the upstream list', async () => {
    mockFetchResponse(buildList('still-listed.example'));
    const prisma = mockPrisma([
      { domain: 'still-listed.example', source: 'LIST_SYNC' },
      { domain: 'delisted.example', source: 'LIST_SYNC' },
      { domain: 'hand-added.example', source: 'MANUAL' },
    ]);

    await syncBlockedEmailDomains(asPrismaClient(prisma));

    expect(prisma.blockedEmailDomain.deleteMany).toHaveBeenCalledWith({
      where: { domain: { in: ['delisted.example'] }, source: 'LIST_SYNC' },
    });
  });

  it('should never rewrite a domain that already has a row, so a MANUAL allowlist entry survives', async () => {
    mockFetchResponse(buildList('burner.example'));
    const prisma = mockPrisma([{ domain: 'burner.example', source: 'MANUAL' }]);

    await syncBlockedEmailDomains(asPrismaClient(prisma));

    expect(insertedDomains(prisma)).not.toContain('burner.example');
  });

  it('should abort without writing when the list comes back suspiciously short', async () => {
    mockFetchResponse(['a.example', 'b.example'].join('\n'));
    const prisma = mockPrisma([{ domain: 'delisted.example', source: 'LIST_SYNC' }]);

    await expect(syncBlockedEmailDomains(asPrismaClient(prisma))).rejects.toThrow(/expected at least 5000/);
    expect(prisma.blockedEmailDomain.createMany).not.toHaveBeenCalled();
    expect(prisma.blockedEmailDomain.deleteMany).not.toHaveBeenCalled();
  });

  it('should throw without writing when the fetch fails', async () => {
    mockFetchResponse('', false, 503);
    const prisma = mockPrisma();

    await expect(syncBlockedEmailDomains(asPrismaClient(prisma))).rejects.toThrow(/503/);
    expect(prisma.blockedEmailDomain.createMany).not.toHaveBeenCalled();
  });

  it('should report counts without writing in test mode', async () => {
    process.env.TEST_MODE = 'true';
    mockFetchResponse(buildList('burner.example'));
    const prisma = mockPrisma([{ domain: 'delisted.example', source: 'LIST_SYNC' }]);

    const result = await syncBlockedEmailDomains(asPrismaClient(prisma));

    expect(result.testMode).toBe(true);
    expect(result.added).toBe(5201);
    expect(result.removed).toBe(1);
    expect(prisma.blockedEmailDomain.createMany).not.toHaveBeenCalled();
    expect(prisma.blockedEmailDomain.deleteMany).not.toHaveBeenCalled();
  });
});
