import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptedInvitation, addMemberFromInvitation } from '../membership';
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
};

function run(invitation: AcceptedInvitation = { id: 'invite-1', role: 'MEMBER', features: ['ALL'] }) {
  return addMemberFromInvitation(tx as any, { teamId: TEAM_ID, userId: USER_ID, invitation });
}

describe('addMemberFromInvitation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'MEMBER', features: ['ALL'] });
    tx.teamMember.create.mockImplementation(async ({ data }) => ({ role: data.role, status: data.status, features: data.features }));
  });

  it('takes the team lock, then re-reads the unexpired invitation before converting its reservation', async () => {
    await run();

    expect(lockTeamForSeatChange).toHaveBeenCalledWith(tx, TEAM_ID);
    expect(tx.teamMemberInvitation.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'invite-1', expiresAt: { gte: expect.any(Date) } },
      select: { role: true, features: true },
    });
    expect(assertSeatAvailable).toHaveBeenCalledWith(tx, { teamId: TEAM_ID, kind: 'ACCEPT_INVITATION', role: 'MEMBER' });
    expect(tx.teamMemberInvitation.delete).toHaveBeenCalledWith({ where: { id: 'invite-1' } });
  });

  it('grants the role and features from the locked re-read, not the caller snapshot', async () => {
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'ADMIN', features: ['QUERY'] });

    const result = await run({ id: 'invite-1', role: 'MEMBER', features: ['ALL'] });

    expect(assertSeatAvailable).toHaveBeenCalledWith(tx, { teamId: TEAM_ID, kind: 'ACCEPT_INVITATION', role: 'ADMIN' });
    expect(tx.teamMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ teamId: TEAM_ID, userId: USER_ID, role: 'ADMIN', features: ['QUERY'], status: 'ACTIVE' }),
      }),
    );
    expect(result).toEqual({ role: 'ADMIN', status: 'ACTIVE', features: ['QUERY'] });
  });

  it('never checks seats for a BILLING invitation', async () => {
    tx.teamMemberInvitation.findFirstOrThrow.mockResolvedValue({ role: 'BILLING', features: ['ALL'] });

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
