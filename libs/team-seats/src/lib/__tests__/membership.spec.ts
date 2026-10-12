import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptedInvitation, addMemberFromInvitation, findDefaultAccessProfileId } from '../membership';
import { assertSeatAvailable, lockTeamForSeatChange } from '../seat-enforcement';

vi.mock('../seat-enforcement', () => ({
  assertSeatAvailable: vi.fn(),
  lockTeamForSeatChange: vi.fn(),
}));

const TEAM_ID = 'team-1';
const USER_ID = 'user-1';

const tx = {
  teamMemberInvitation: {
    findFirstOrThrow: vi.fn(),
    delete: vi.fn(),
  },
  teamMember: {
    create: vi.fn(),
  },
  teamAccessProfile: {
    findFirst: vi.fn(),
  },
};

function run(invitation: AcceptedInvitation = { id: 'invite-1', role: 'MEMBER' }) {
  return addMemberFromInvitation(tx as any, { teamId: TEAM_ID, userId: USER_ID, invitation });
}

describe('addMemberFromInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'MEMBER', accessProfileId: null });
    tx.teamMember.create.mockImplementation(async ({ data }) => ({
      role: data.role,
      status: data.status,
      accessProfileId: data.accessProfileId,
    }));
  });

  it('takes the team lock, then re-reads the unexpired invitation before converting its reservation', async () => {
    await run();

    expect(lockTeamForSeatChange).toHaveBeenCalledWith(tx, TEAM_ID);
    expect(tx.teamMemberInvitation.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'invite-1', teamId: TEAM_ID, expiresAt: { gte: expect.any(Date) } },
      select: { role: true, accessProfileId: true },
    });
    expect(assertSeatAvailable).toHaveBeenCalledWith(tx, { teamId: TEAM_ID, kind: 'ACCEPT_INVITATION', role: 'MEMBER' });
    expect(tx.teamMemberInvitation.delete).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
  });

  it('grants the role and access profile from the locked re-read, not the caller snapshot', async () => {
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'ADMIN', accessProfileId: null });

    const result = await run({ id: 'invite-1', role: 'MEMBER' });

    expect(assertSeatAvailable).toHaveBeenCalledWith(tx, { teamId: TEAM_ID, kind: 'ACCEPT_INVITATION', role: 'ADMIN' });
    expect(tx.teamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: TEAM_ID, userId: USER_ID, role: 'ADMIN', status: 'ACTIVE' }),
      }),
    );
    expect(result).toEqual({ role: 'ADMIN', status: 'ACTIVE', accessProfileId: null });
  });

  it("copies the invitation's access profile onto the new membership and returns it", async () => {
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'MEMBER', accessProfileId: 'profile-1' });

    const result = await run();

    expect(tx.teamMember.create).toHaveBeenCalledWith({
      select: { role: true, status: true, accessProfileId: true },
      data: expect.objectContaining({ teamId: TEAM_ID, userId: USER_ID, accessProfileId: 'profile-1' }),
    });
    expect(result).toEqual({ role: 'MEMBER', status: 'ACTIVE', accessProfileId: 'profile-1' });
  });

  it('creates a full access membership when the invitation has no access profile', async () => {
    await run();

    expect(tx.teamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ accessProfileId: null }) }),
    );
  });

  it('never checks seats for a BILLING invitation', async () => {
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'BILLING', accessProfileId: null });

    await run();

    expect(assertSeatAvailable).not.toHaveBeenCalled();
    expect(tx.teamMember.create).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when the seat check rejects', async () => {
    vi.mocked(assertSeatAvailable).mockRejectedValueOnce(new Error('no seats'));

    await expect(run()).rejects.toThrow('no seats');

    expect(tx.teamMemberInvitation.delete).not.toHaveBeenCalled();
    expect(tx.teamMember.create).not.toHaveBeenCalled();
  });
});

describe('findDefaultAccessProfileId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the id of the team's oldest default profile", async () => {
    tx.teamAccessProfile.findFirst.mockResolvedValue({ id: 'profile-default' });

    await expect(findDefaultAccessProfileId(tx as any, TEAM_ID)).resolves.toBe('profile-default');

    expect(tx.teamAccessProfile.findFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: { teamId: TEAM_ID, isDefault: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('returns null (full access) when the team has no default profile', async () => {
    tx.teamAccessProfile.findFirst.mockResolvedValue(null);

    await expect(findDefaultAccessProfileId(tx as any, TEAM_ID)).resolves.toBeNull();
  });
});
