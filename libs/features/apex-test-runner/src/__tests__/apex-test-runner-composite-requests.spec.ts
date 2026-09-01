import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { abortTestRun, updateTestSuiteMembership } from '../apex-test-runner-data.utils';

const { makeToolingRequestsMock, queryMock } = vi.hoisted(() => ({
  makeToolingRequestsMock: vi.fn(),
  queryMock: vi.fn(),
}));

vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  makeToolingRequests: makeToolingRequestsMock,
}));

vi.mock('@jetstream/shared/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/data')>()),
  query: queryMock,
}));

const org = { uniqueId: 'org-composite-spec' } as SalesforceOrgUi;
const API_VERSION = 'v64.0';

function compositeItem(httpStatusCode: number, referenceId: string, body: unknown = null) {
  return { httpStatusCode, referenceId, body, httpHeaders: {} };
}

beforeEach(() => {
  makeToolingRequestsMock.mockReset();
  queryMock.mockReset();
});

describe('updateTestSuiteMembership', () => {
  it('resolves when every subrequest succeeds and requests an atomic (allOrNone) save', async () => {
    makeToolingRequestsMock.mockResolvedValue({
      compositeResponse: [compositeItem(201, 'add_0', { id: '01p000000000001', success: true }), compositeItem(204, 'remove_0')],
    });

    await updateTestSuiteMembership(org, API_VERSION, '05F000000000001', {
      addClassIds: ['01p000000000001'],
      removeMembershipIds: ['05G000000000001'],
    });

    expect(makeToolingRequestsMock).toHaveBeenCalledTimes(1);
    const [, compositeRequests, apiVersion, allOrNone] = makeToolingRequestsMock.mock.calls[0];
    expect(compositeRequests).toHaveLength(2);
    expect(apiVersion).toBe(API_VERSION);
    expect(allOrNone).toBe(true);
  });

  it('skips the API call entirely when there are no membership changes', async () => {
    await updateTestSuiteMembership(org, API_VERSION, '05F000000000001', { addClassIds: [], removeMembershipIds: [] });
    expect(makeToolingRequestsMock).not.toHaveBeenCalled();
  });

  it('throws the Salesforce error when a subrequest fails, ignoring rollback noise from sibling items', async () => {
    // Composite requests return per-item statuses inside an overall 200 response
    makeToolingRequestsMock.mockResolvedValue({
      compositeResponse: [
        compositeItem(400, 'add_0', [{ errorCode: 'MALFORMED_ID', message: 'malformed id 01pXXX' }]),
        compositeItem(400, 'remove_0', [
          {
            errorCode: 'PROCESSING_HALTED',
            message: 'The transaction was rolled back since another operation in the same transaction failed.',
          },
        ]),
      ],
    });

    await expect(
      updateTestSuiteMembership(org, API_VERSION, '05F000000000001', {
        addClassIds: ['01pXXX'],
        removeMembershipIds: ['05G000000000001'],
      }),
    ).rejects.toThrow('malformed id 01pXXX');
  });

  it('throws a fallback message when a failed subrequest has no error body', async () => {
    makeToolingRequestsMock.mockResolvedValue({ compositeResponse: [compositeItem(500, 'add_0')] });

    await expect(
      updateTestSuiteMembership(org, API_VERSION, '05F000000000001', { addClassIds: ['01p000000000001'], removeMembershipIds: [] }),
    ).rejects.toThrow('Unable to save the test suite changes');
  });
});

describe('abortTestRun', () => {
  function mockQueueItems(statuses: string[]) {
    queryMock.mockResolvedValue({
      queryResults: {
        records: statuses.map((status, i) => ({ Id: `70900000000000${i}`, Status: status })),
      },
    });
  }

  it('returns the aborted item count when every PATCH succeeds', async () => {
    mockQueueItems(['Queued', 'Processing', 'Completed']);
    makeToolingRequestsMock.mockResolvedValue({
      compositeResponse: [compositeItem(204, 'abort_0'), compositeItem(204, 'abort_1')],
    });

    await expect(abortTestRun(org, API_VERSION, '707000000000001')).resolves.toBe(2);
  });

  it('returns 0 without any composite call when no queue items are in progress', async () => {
    mockQueueItems(['Completed', 'Failed']);

    await expect(abortTestRun(org, API_VERSION, '707000000000001')).resolves.toBe(0);
    expect(makeToolingRequestsMock).not.toHaveBeenCalled();
  });

  it('throws when any PATCH fails so the UI does not report a successful abort', async () => {
    mockQueueItems(['Queued', 'Processing']);
    makeToolingRequestsMock.mockResolvedValue({
      compositeResponse: [
        compositeItem(204, 'abort_0'),
        compositeItem(409, 'abort_1', [{ errorCode: 'ENTITY_IS_LOCKED', message: 'record is locked' }]),
      ],
    });

    await expect(abortTestRun(org, API_VERSION, '707000000000001')).rejects.toThrow('record is locked');
  });
});
