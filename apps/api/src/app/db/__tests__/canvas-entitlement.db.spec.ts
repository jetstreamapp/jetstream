import { Prisma } from '@jetstream/prisma';
import { SALESFORCE_CANVAS_ORG_LIMIT } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCanvasOrg, deleteCanvasOrg, isCanvasOrgEntitled, parseMyDomainBase } from '../canvas-entitlement.db';

const prismaMock = vi.hoisted(() => ({
  salesforceCanvasOrg: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  teamEntitlement: {
    count: vi.fn(),
  },
  entitlement: {
    count: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  prisma: prismaMock,
}));

const PROD_ORG_ID = '00D000000000001AAA';
const SANDBOX_ORG_ID = '00D000000000999AAA';

describe('parseMyDomainBase', () => {
  it('returns the base for a production My Domain URL', () => {
    expect(parseMyDomainBase('https://acme.my.salesforce.com')).toBe('acme');
  });

  it('strips the sandbox suffix to share the production base', () => {
    expect(parseMyDomainBase('https://acme--uat.sandbox.my.salesforce.com')).toBe('acme');
  });

  it('returns null for an unparseable value', () => {
    expect(parseMyDomainBase('not-a-url')).toBeNull();
  });
});

describe('isCanvasOrgEntitled', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.teamEntitlement.count.mockResolvedValue(0);
    prismaMock.entitlement.count.mockResolvedValue(0);
  });

  it('grants access when an ACTIVE authorization exists and the user owner holds salesforceCanvas', async () => {
    prismaMock.salesforceCanvasOrg.findMany.mockResolvedValue([{ jetstreamUserId: 'user-1', teamId: null }]);
    prismaMock.entitlement.count.mockResolvedValue(1);

    const result = await isCanvasOrgEntitled(PROD_ORG_ID, 'https://acme.my.salesforce.com');

    expect(result).toBe(true);
    // Only ACTIVE records, matched on the 15-char org id prefix (tolerates 15/18-char ids)
    expect(prismaMock.salesforceCanvasOrg.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'ACTIVE',
          OR: expect.arrayContaining([{ organizationId: { startsWith: PROD_ORG_ID.slice(0, 15) } }]),
        }),
      }),
    );
    expect(prismaMock.entitlement.count).toHaveBeenCalledWith({ where: { userId: 'user-1', salesforceCanvas: true } });
  });

  it('grants access for a team-owned authorization via the team entitlement', async () => {
    prismaMock.salesforceCanvasOrg.findMany.mockResolvedValue([{ jetstreamUserId: null, teamId: 'team-1' }]);
    prismaMock.teamEntitlement.count.mockResolvedValue(1);

    expect(await isCanvasOrgEntitled(PROD_ORG_ID, 'https://acme.my.salesforce.com')).toBe(true);
    expect(prismaMock.teamEntitlement.count).toHaveBeenCalledWith({ where: { teamId: 'team-1', salesforceCanvas: true } });
    // Team-owned record (DB enforces user XOR team) — only the team entitlement is consulted
    expect(prismaMock.entitlement.count).not.toHaveBeenCalled();
  });

  it('grants a sandbox access by matching the My Domain base of an entitled production authorization', async () => {
    prismaMock.salesforceCanvasOrg.findMany.mockResolvedValue([{ jetstreamUserId: 'user-1', teamId: null }]);
    prismaMock.entitlement.count.mockResolvedValue(1);

    const result = await isCanvasOrgEntitled(SANDBOX_ORG_ID, 'https://acme--uat.sandbox.my.salesforce.com');

    expect(result).toBe(true);
    expect(prismaMock.salesforceCanvasOrg.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.arrayContaining([{ myDomainBase: 'acme' }]) }) }),
    );
  });

  it('denies access when the authorization exists but the owner is not entitled', async () => {
    prismaMock.salesforceCanvasOrg.findMany.mockResolvedValue([{ jetstreamUserId: 'user-1', teamId: null }]);

    expect(await isCanvasOrgEntitled(PROD_ORG_ID, 'https://acme.my.salesforce.com')).toBe(false);
  });

  it('denies access when no authorization record matches', async () => {
    prismaMock.salesforceCanvasOrg.findMany.mockResolvedValue([]);

    expect(await isCanvasOrgEntitled(PROD_ORG_ID, 'https://acme.my.salesforce.com')).toBe(false);
    expect(prismaMock.entitlement.count).not.toHaveBeenCalled();
  });
});

describe('createCanvasOrg', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.salesforceCanvasOrg.count.mockResolvedValue(0);
  });

  it('normalizes the org id to 15 chars, derives instanceUrl, and scopes to the user owner', async () => {
    prismaMock.salesforceCanvasOrg.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: 'row-1',
        organizationId: data.organizationId,
        instanceUrl: data.instanceUrl,
        myDomainBase: data.myDomainBase,
        orgName: data.orgName ?? null,
        isSandbox: data.isSandbox,
        status: data.status,
        createdAt: new Date('2026-01-01T00:00:00Z'),
        updatedAt: new Date('2026-01-01T00:00:00Z'),
      }),
    );

    const result = await createCanvasOrg({
      owner: { type: 'user', userId: 'user-1' },
      authorizedByUserId: 'user-1',
      organizationId: PROD_ORG_ID, // 18 chars
      myDomainBase: 'Acme',
    });

    expect(result.organizationId).toBe(PROD_ORG_ID.slice(0, 15));
    expect(result.instanceUrl).toBe('https://acme.my.salesforce.com');
    const createArg = prismaMock.salesforceCanvasOrg.create.mock.calls[0][0];
    expect(createArg.data).toMatchObject({
      organizationId: PROD_ORG_ID.slice(0, 15),
      myDomainBase: 'acme',
      instanceUrl: 'https://acme.my.salesforce.com',
      isSandbox: false,
      status: 'ACTIVE',
      authorizedByUserId: 'user-1',
      jetstreamUserId: 'user-1',
    });
    expect(createArg.data.teamId).toBeUndefined();
  });

  it('enforces the org limit and does not create beyond it', async () => {
    prismaMock.salesforceCanvasOrg.count.mockResolvedValue(SALESFORCE_CANVAS_ORG_LIMIT);

    await expect(
      createCanvasOrg({
        owner: { type: 'team', teamId: 'team-1' },
        authorizedByUserId: 'user-1',
        organizationId: PROD_ORG_ID,
        myDomainBase: 'acme',
      }),
    ).rejects.toThrow(/limit/i);
    expect(prismaMock.salesforceCanvasOrg.create).not.toHaveBeenCalled();
  });

  it('surfaces a friendly error when the org is already authorized (unique violation)', async () => {
    prismaMock.salesforceCanvasOrg.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    await expect(
      createCanvasOrg({
        owner: { type: 'user', userId: 'user-1' },
        authorizedByUserId: 'user-1',
        organizationId: PROD_ORG_ID,
        myDomainBase: 'acme',
      }),
    ).rejects.toThrow(/already authorized/i);
  });
});

describe('deleteCanvasOrg', () => {
  beforeEach(() => vi.clearAllMocks());

  it('scopes the delete to the team owner', async () => {
    prismaMock.salesforceCanvasOrg.deleteMany.mockResolvedValue({ count: 1 });

    await deleteCanvasOrg({ owner: { type: 'team', teamId: 'team-1' }, id: 'row-1' });

    expect(prismaMock.salesforceCanvasOrg.deleteMany).toHaveBeenCalledWith({ where: { id: 'row-1', teamId: 'team-1' } });
  });

  it('throws when nothing matches the owner scope', async () => {
    prismaMock.salesforceCanvasOrg.deleteMany.mockResolvedValue({ count: 0 });

    await expect(deleteCanvasOrg({ owner: { type: 'user', userId: 'user-1' }, id: 'row-1' })).rejects.toThrow(/not found/i);
  });
});
