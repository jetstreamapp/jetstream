/**
 * The heartbeat is how a signed-in client notices that its team access profile changed (it was moved to another
 * profile, or its profile was edited) without downloading the policy on every poll.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import routes from '../api.routes';

const mocks = vi.hoisted(() => ({
  findActiveTeamAccessProfile: vi.fn(),
  getAnnouncements: vi.fn(),
  sendJson: vi.fn(),
}));

vi.mock('../../db/user.db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../db/user.db')>()),
  findActiveTeamAccessProfile: mocks.findActiveTeamAccessProfile,
}));
vi.mock('../../announcements', () => ({ getAnnouncements: mocks.getAnnouncements }));
vi.mock('../../utils/response.handlers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/response.handlers')>()),
  sendJson: mocks.sendJson,
}));

async function invokeHeartbeat(sessionUser?: { id: string }) {
  const heartbeatLayer = routes.stack.find(({ route }) => route?.path === '/heartbeat');
  if (!heartbeatLayer?.route) {
    throw new Error('The /heartbeat route is not registered');
  }
  const [{ handle }] = heartbeatLayer.route.stack;
  const req = { session: { user: sessionUser } };
  const res = {};
  await handle(req as never, res as never, vi.fn());
  return { res };
}

describe('GET /heartbeat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAnnouncements.mockResolvedValue([]);
  });

  it("includes the signed-in user's access profile fingerprint", async () => {
    mocks.findActiveTeamAccessProfile.mockResolvedValue({ id: 'profile-1', version: 3, policy: {} });

    const { res } = await invokeHeartbeat({ id: 'user-1' });

    expect(mocks.findActiveTeamAccessProfile).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(mocks.sendJson).toHaveBeenCalledWith(res, expect.objectContaining({ accessProfileFingerprint: 'profile-1:3' }));
  });

  it('reports full access for a user without a profile', async () => {
    mocks.findActiveTeamAccessProfile.mockResolvedValue(null);

    const { res } = await invokeHeartbeat({ id: 'user-1' });

    expect(mocks.sendJson).toHaveBeenCalledWith(res, expect.objectContaining({ accessProfileFingerprint: 'FULL_ACCESS' }));
  });

  it('omits the fingerprint when there is no signed-in user', async () => {
    const { res } = await invokeHeartbeat();

    expect(mocks.findActiveTeamAccessProfile).not.toHaveBeenCalled();
    const [sentRes, appInfo] = mocks.sendJson.mock.calls[0];
    expect(sentRes).toBe(res);
    expect(appInfo.accessProfileFingerprint).toBeUndefined();
  });

  it('still responds, without a fingerprint, when the lookup fails', async () => {
    mocks.findActiveTeamAccessProfile.mockRejectedValue(new Error('database unavailable'));

    const { res } = await invokeHeartbeat({ id: 'user-1' });

    const [sentRes, appInfo] = mocks.sendJson.mock.calls[0];
    expect(sentRes).toBe(res);
    expect(appInfo.accessProfileFingerprint).toBeUndefined();
    expect(appInfo.announcements).toEqual([]);
  });
});
