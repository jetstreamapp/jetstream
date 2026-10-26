import type { UserProfileSession } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import type express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as salesforceOrgsDb from '../../db/salesforce-org.db';
import * as userDb from '../../db/user.db';
import { NotAllowedError } from '../../utils/error-handler';
import {
  clearWebAppAccessCache,
  getOrgForRequest,
  getOrgFromHeaderOrQuery,
  verifyWebAppAllowed,
  WEB_APP_NOT_ALLOWED_MESSAGE,
} from '../route.middleware';

vi.mock('../../db/user.db', () => ({
  checkUserEntitlement: vi.fn(),
  findActiveTeamAccessProfile: vi.fn(),
}));

vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
}));

const mockFindAccessProfile = vi.mocked(userDb.findActiveTeamAccessProfile);

const webProfile = { id: 'profile-web', version: 1, policy: { v: 1, tools: [], operations: [], surfaces: ['web'] } };
const desktopOnlyProfile = { id: 'profile-desktop', version: 1, policy: { v: 1, tools: [], operations: [], surfaces: ['desktop'] } };
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
    clearWebAppAccessCache();
  });

  describe('verifyWebAppAllowed', () => {
    it('continues when the access profile allows the web application', async () => {
      mockFindAccessProfile.mockResolvedValue(webProfile);

      await expect(runVerifyWebAppAllowed(user)).resolves.toBeUndefined();
      expect(mockFindAccessProfile).toHaveBeenCalledWith({ userId: user.id });
    });

    it('refuses with a 403 when the access profile excludes the web application', async () => {
      mockFindAccessProfile.mockResolvedValue(desktopOnlyProfile);

      const error = await runVerifyWebAppAllowed(user);

      expect(error).toBeInstanceOf(NotAllowedError);
      expect(error.status).toBe(403);
      expect(error.message).toBe(WEB_APP_NOT_ALLOWED_MESSAGE);
    });

    it('allows a member without an access profile', async () => {
      mockFindAccessProfile.mockResolvedValue(null);

      await expect(runVerifyWebAppAllowed(user)).resolves.toBeUndefined();
    });

    it('passes a database failure on instead of allowing the request', async () => {
      mockFindAccessProfile.mockRejectedValue(new Error('Connection terminated unexpectedly'));

      await expect(runVerifyWebAppAllowed(user)).resolves.toBeInstanceOf(Error);
    });
  });

  describe('getOrgForRequest', () => {
    it('refuses before loading the org when the access profile excludes the web application', async () => {
      mockFindAccessProfile.mockResolvedValue(desktopOnlyProfile);

      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow(WEB_APP_NOT_ALLOWED_MESSAGE);
      expect(mockFindOrg).not.toHaveBeenCalled();
    });

    it('loads the org when the access profile allows the web application', async () => {
      mockFindAccessProfile.mockResolvedValue(webProfile);
      mockFindOrg.mockResolvedValue(null);

      // No org on record, so the lookup itself fails after the access check passes
      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow('An org with the provided id does not exist');
      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-1');
    });

    it('reuses a recent allowed result across requests, but never serves a denial from the cache', async () => {
      mockFindAccessProfile.mockResolvedValue(webProfile);
      mockFindOrg.mockResolvedValue(null);

      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow('An org with the provided id does not exist');
      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow('An org with the provided id does not exist');
      expect(mockFindAccessProfile).toHaveBeenCalledTimes(1);

      clearWebAppAccessCache();
      mockFindAccessProfile.mockResolvedValue(desktopOnlyProfile);
      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow(WEB_APP_NOT_ALLOWED_MESSAGE);
      await expect(getOrgForRequest(user, 'org-1')).rejects.toThrow(WEB_APP_NOT_ALLOWED_MESSAGE);
      expect(mockFindAccessProfile).toHaveBeenCalledTimes(3);
    });
  });

  describe('getOrgFromHeaderOrQuery', () => {
    it('checks access once for a request that resolves a source and a target org', async () => {
      mockFindAccessProfile.mockResolvedValue(webProfile);
      mockFindOrg.mockResolvedValue(null);
      const headers: Record<string, string> = { [HTTP.HEADERS.X_SFDC_ID]: 'org-1', [HTTP.HEADERS.X_SFDC_ID_TARGET]: 'org-2' };
      const req = { session: { user }, query: {}, get: (name: string) => headers[name] } as unknown as express.Request;
      const res = { locals: {} } as express.Response;

      // No org on record, so each lookup fails after the access check
      await expect(getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION)).rejects.toThrow();
      await expect(
        getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID_TARGET, HTTP.HEADERS.X_SFDC_API_TARGET_VERSION),
      ).rejects.toThrow();

      expect(mockFindOrg).toHaveBeenCalledTimes(2);
      expect(mockFindAccessProfile).toHaveBeenCalledTimes(1);
    });
  });
});
