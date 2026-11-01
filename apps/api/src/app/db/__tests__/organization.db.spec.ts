import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Deleting an org group with its orgs must be atomic, and only the requesting user's orgs in that group may be deleted.
 * The deleted orgs are returned so the controller can write an ORG_DELETED audit entry for each one.
 */

const txMock = vi.hoisted(() => ({
  salesforceOrg: {
    findMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  jetstreamOrganization: {
    delete: vi.fn(),
  },
}));

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
}));

vi.mock('@jetstream/api-config', () => ({
  prisma: prismaMock,
}));

const { deleteOrgGroupAndAllOrgs } = await import('../organization.db');

const USER_ID = 'user-abc';
const GROUP_ID = 'group-123';

const ORGS_IN_GROUP = [
  {
    uniqueId: 'org-1-unique',
    username: 'admin@org1.com',
    label: 'Org 1',
    orgName: 'Org One',
    loginUrl: 'https://login.salesforce.com',
    instanceUrl: 'https://org1.my.salesforce.com',
    orgIsSandbox: false,
  },
  {
    uniqueId: 'org-2-unique',
    username: 'admin@org2.com',
    label: 'Org 2',
    orgName: 'Org Two',
    loginUrl: 'https://test.salesforce.com',
    instanceUrl: 'https://org2.sandbox.my.salesforce.com',
    orgIsSandbox: true,
  },
];

describe('deleteOrgGroupAndAllOrgs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.$transaction.mockImplementation(async (callback: (tx: typeof txMock) => unknown) => callback(txMock));
    txMock.salesforceOrg.findMany.mockResolvedValue(ORGS_IN_GROUP);
    txMock.salesforceOrg.deleteMany.mockResolvedValue({ count: ORGS_IN_GROUP.length });
    txMock.jetstreamOrganization.delete.mockResolvedValue({ id: GROUP_ID, name: 'Group', orgs: [] });
  });

  it('runs every read and delete inside a single transaction', async () => {
    await deleteOrgGroupAndAllOrgs(USER_ID, GROUP_ID);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(txMock.salesforceOrg.findMany).toHaveBeenCalledTimes(1);
    expect(txMock.salesforceOrg.deleteMany).toHaveBeenCalledTimes(1);
    expect(txMock.jetstreamOrganization.delete).toHaveBeenCalledTimes(1);
  });

  it('scopes the org read and delete to the group and the requesting user', async () => {
    await deleteOrgGroupAndAllOrgs(USER_ID, GROUP_ID);

    const expectedWhere = { jetstreamOrganizationId: GROUP_ID, jetstreamUserId2: USER_ID };
    expect(txMock.salesforceOrg.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expectedWhere }));
    expect(txMock.salesforceOrg.deleteMany).toHaveBeenCalledWith({ where: expectedWhere });
    expect(txMock.jetstreamOrganization.delete).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID, id: GROUP_ID } }));
  });

  it('returns the deleted orgs for audit logging', async () => {
    const { deletedOrgs } = await deleteOrgGroupAndAllOrgs(USER_ID, GROUP_ID);

    expect(deletedOrgs).toEqual(ORGS_IN_GROUP);
  });

  it('propagates a failure deleting the group so the transaction rolls back the org deletes', async () => {
    txMock.jetstreamOrganization.delete.mockRejectedValue(new Error('Record to delete does not exist'));

    await expect(deleteOrgGroupAndAllOrgs(USER_ID, GROUP_ID)).rejects.toThrow('Record to delete does not exist');
  });
});
