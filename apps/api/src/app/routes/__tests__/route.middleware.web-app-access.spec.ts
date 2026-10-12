import type { UserProfileSession } from '@jetstream/auth/types';
import type express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as salesforceOrgsDb from '../../db/salesforce-org.db';
import * as userDb from '../../db/user.db';
import { NotAllowedError } from '../../utils/error-handler';
import { getOrgForRequest, verifyWebAppAllowed, WEB_APP_NOT_ALLOWED_MESSAGE } from '../route.middleware';

vi.mock('../../db/user.db', () => ({
  checkUserEntitlement: vi.fn(),
  isAccessProfileSurfaceAllowedForUser: vi.fn(),
}));

vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
}));

const mockIsSurfaceAllowed = vi.mocked(userDb.isAccessProfileSurfaceAllowedForUser);
const mockFindOrg = vi.mocked(salesforceOrgsDb.findByUniqueId_UNSAFE);

const user = { id: 'user-1' } as UserProfileSession;

function runVerifyWebAppAllowed(sessionUser: UserProfileSession | undefined) {
  const next = vi.fn();
  const req = { session: { user: sessionUser } } as unknown as express.Request;
  return verifyWebAppAllowed(req, {} as express.Response, next).then(() => next.mock.calls[0][0]);
}

describe('web application access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('verifyWebAppAllowed', () => {
    it('continues when the access profile allows the web application', async () => {
      mockIsSurfaceAllowed.mockResolvedValue(true);

      await expect(runVerifyWebAppAllowed(user)).resolves.toBeUndefined();
      expect(mockIsSurfaceAllowed).toHaveBeenCalledWith({ userId: user.id, surface: 'web' });
    });

    it('refuses with a 403 when the access profile excludes the web application', async () => {
      mockIsSurfaceAllowed.mockResolvedValue(false);

      const error = await runVerifyWebAppAllowed(user);

      expect(error).toBeInstanceOf(NotAllowedError);
      expect(error.status).toBe(403);
      expect(error.message).toBe(WEB_APP_NOT_ALLOWED_MESSAGE);
    });

    it('passes a database failure on instead of allowing the request', async () => {
      mockIsSurfaceAllowed.mockRejectedValue(new Error('Connection terminated unexpectedly'));

      await expect(runVerifyWebAppAllowed(user)).resolves.toBeInstanceOf(Error);
    });
  });

  describe('getOrgForRequest', () => {
    it('refuses before loading the org when the access profile excludes the web application', async () => {
      mockIsSurfaceAllowed.mockResolvedValue(false);

      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow(WEB_APP_NOT_ALLOWED_MESSAGE);
      expect(mockFindOrg).not.toHaveBeenCalled();
    });

    it('loads the org when the access profile allows the web application', async () => {
      mockIsSurfaceAllowed.mockResolvedValue(true);
      mockFindOrg.mockResolvedValue(null);

      // No org on record, so the lookup itself fails after the access check passes
      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow('An org with the provided id does not exist');
      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-1');
    });
  });
});
