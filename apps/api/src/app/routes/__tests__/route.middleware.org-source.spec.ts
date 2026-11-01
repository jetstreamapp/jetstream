import type { UserProfileSession } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import type express from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as salesforceOrgsDb from '../../db/salesforce-org.db';
import * as userDb from '../../db/user.db';
import { NotFoundError } from '../../utils/error-handler';
import { addOrgsToLocal, addOrgsToLocalFromHeaderOrQuery, clearWebAppAccessCache, getOrgFromHeaderOrQuery } from '../route.middleware';

vi.mock('../../db/user.db', () => ({
  checkUserEntitlement: vi.fn(),
  findActiveTeamAccessProfile: vi.fn(),
}));

vi.mock('../../db/salesforce-org.db', () => ({
  findByUniqueId_UNSAFE: vi.fn(),
}));

const mockFindAccessProfile = vi.mocked(userDb.findActiveTeamAccessProfile);
const mockFindOrg = vi.mocked(salesforceOrgsDb.findByUniqueId_UNSAFE);

const user = { id: 'user-1' } as UserProfileSession;

function buildRequest({ headers = {}, query = {} }: { headers?: Record<string, string>; query?: Record<string, string> }) {
  const req = { session: { user }, query, get: (name: string) => headers[name] } as unknown as express.Request;
  const res = { locals: {}, set: vi.fn() } as unknown as express.Response;
  return { req, res };
}

/**
 * No org is on record, so a lookup that happens surfaces as a NotFoundError passed to next(); a lookup that
 * is refused at the source never reaches the database and next() is called with nothing.
 */
describe('org selection sources', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearWebAppAccessCache();
    mockFindAccessProfile.mockResolvedValue(null);
    mockFindOrg.mockResolvedValue(null);
  });

  describe('addOrgsToLocal (router default)', () => {
    it('resolves the org named in the header', async () => {
      const { req, res } = buildRequest({ headers: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1' } });
      const next = vi.fn();

      await addOrgsToLocal(req, res, next);

      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-1');
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });

    it('ignores an org named only in the query string', async () => {
      const { req, res } = buildRequest({ query: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1', [HTTP.HEADERS.X_SFDC_ID_TARGET]: 'org-2' } });
      const next = vi.fn();

      await addOrgsToLocal(req, res, next);

      expect(mockFindOrg).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
      expect(res.locals.org).toBeUndefined();
      expect(res.locals.targetOrg).toBeUndefined();
    });

    it('ignores a query-string target org even when the source org comes from the header', async () => {
      const { req, res } = buildRequest({
        headers: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1' },
        query: { [HTTP.HEADERS.X_SFDC_ID_TARGET]: 'org-2' },
      });

      await addOrgsToLocal(req, res, vi.fn());

      expect(mockFindOrg).toHaveBeenCalledTimes(1);
      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-1');
    });
  });

  describe('addOrgsToLocalFromHeaderOrQuery (navigation routes)', () => {
    it('resolves the org named in the query string', async () => {
      const { req, res } = buildRequest({ query: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1' } });
      const next = vi.fn();

      await addOrgsToLocalFromHeaderOrQuery(req, res, next);

      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-1');
      expect(next.mock.calls[0][0]).toBeInstanceOf(NotFoundError);
    });

    it('prefers the header when both are present', async () => {
      const { req, res } = buildRequest({
        headers: { [HTTP.HEADERS.X_SFDC_ID]: 'org-header' },
        query: { [HTTP.HEADERS.X_SFDC_ID]: 'org-query' },
      });

      await addOrgsToLocalFromHeaderOrQuery(req, res, vi.fn());

      expect(mockFindOrg).toHaveBeenCalledTimes(1);
      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-header');
    });

    it('does not resolve again an org the router-level pass already attached', async () => {
      const { req, res } = buildRequest({ headers: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1' } });
      res.locals.org = { id: 'already-resolved' };
      res.locals.jetstreamConn = {};

      await addOrgsToLocalFromHeaderOrQuery(req, res, vi.fn());

      expect(mockFindOrg).not.toHaveBeenCalled();
      expect(res.locals.org).toEqual({ id: 'already-resolved' });
    });
  });

  describe('getOrgFromHeaderOrQuery', () => {
    it('reads only the header by default', async () => {
      const { req, res } = buildRequest({ query: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1' } });

      await expect(getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION)).resolves.toBeUndefined();
      expect(mockFindOrg).not.toHaveBeenCalled();
    });

    it('reads the query string when the caller opts in', async () => {
      const { req, res } = buildRequest({ query: { [HTTP.HEADERS.X_SFDC_ID]: 'org-1' } });

      await expect(
        getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION, undefined, { allowQueryParam: true }),
      ).rejects.toBeInstanceOf(NotFoundError);
      expect(mockFindOrg).toHaveBeenCalledWith(user.id, 'org-1');
    });

    it('ignores a non-string (repeated) query parameter', async () => {
      const { req, res } = buildRequest({});
      (req.query as Record<string, unknown>)[HTTP.HEADERS.X_SFDC_ID] = ['org-1', 'org-2'];

      await expect(
        getOrgFromHeaderOrQuery(req, res, HTTP.HEADERS.X_SFDC_ID, HTTP.HEADERS.X_SFDC_API_VERSION, undefined, { allowQueryParam: true }),
      ).resolves.toBeUndefined();
      expect(mockFindOrg).not.toHaveBeenCalled();
    });
  });
});
