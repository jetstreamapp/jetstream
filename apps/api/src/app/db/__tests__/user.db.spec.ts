import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateUser } from '../user.db';

const prismaMock = vi.hoisted(() => ({
  user: {
    update: vi.fn(),
  },
}));

vi.mock('@jetstream/api-config', () => ({
  logger: {
    error: vi.fn(),
  },
  prisma: prismaMock,
}));

const sessionUser = {
  id: 'user-session-id',
  email: 'user@example.com',
  name: 'Existing User',
};

describe('updateUser security regressions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({});
  });

  it('stores SQL-looking profile names as literal values scoped to the session user', async () => {
    const name = "Staging Test' AND '1'='1' --";

    await updateUser(sessionUser as any, { name });

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionUser.id },
        data: expect.objectContaining({ name }),
      }),
    );
  });

  it('stores path-looking profile names as literal values and never trusts body identity fields', async () => {
    const name = '../../profile';

    await updateUser(sessionUser as any, { id: 'attacker-selected-id', name } as any);

    expect(prismaMock.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: sessionUser.id },
        data: expect.objectContaining({ name }),
      }),
    );
  });
});

describe('updateUser preferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.user.update.mockResolvedValue({});
  });

  it('writes only the preferences that were sent, so concurrent partial updates cannot undo each other', async () => {
    await updateUser(sessionUser as any, { preferences: { recordSyncEnabled: false } });

    const { data } = prismaMock.user.update.mock.calls[0][0];
    expect(data.name).toBeUndefined();
    expect(data.preferences.upsert.update).toEqual({
      skipFrontdoorLogin: undefined,
      recordSyncEnabled: false,
      soqlQueryFormatOptions: undefined,
    });
  });

  it('fills in defaults for preferences that were not sent when creating the preferences record', async () => {
    await updateUser(sessionUser as any, { preferences: { skipFrontdoorLogin: true } });

    const { data } = prismaMock.user.update.mock.calls[0][0];
    expect(data.preferences.upsert.create).toEqual({
      skipFrontdoorLogin: true,
      recordSyncEnabled: true,
      soqlQueryFormatOptions: expect.objectContaining({ numIndent: 1, fieldMaxLineLength: 1 }),
    });
  });
});
