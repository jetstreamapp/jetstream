import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockedHandleRequest } = vi.hoisted(() => ({ mockedHandleRequest: vi.fn() }));

vi.mock('../client-data-data-helper', () => ({
  handleRequest: mockedHandleRequest,
  handleExternalRequest: vi.fn(),
  transformListMetadataResponse: vi.fn(),
}));

import { queryRemainingSubqueryRecords, queryRemainingSubqueryResults } from '../client-data';

const ORG = { uniqueId: 'org-1' } as unknown as SalesforceOrgUi;

/* eslint-disable @typescript-eslint/no-explicit-any -- record trees are dynamically shaped, so assertions index into `any` */
type AnyRecord = Record<string, any>;

function record(id: string, type: string, extra: Record<string, unknown> = {}): AnyRecord {
  return { Id: id, attributes: { type, url: `/services/data/v65.0/sobjects/${type}/${id}` }, ...extra };
}

function subquery(records: AnyRecord[], nextRecordsUrl?: string, totalSize = records.length) {
  return { done: !nextRecordsUrl, totalSize, records, ...(nextRecordsUrl ? { nextRecordsUrl } : {}) };
}

/** `queryMore` unwraps `{ data }` off the shared request helper, so responses are shaped the way the API returns them. */
function respondWith(pagesByUrl: Record<string, { records: AnyRecord[]; nextRecordsUrl?: string; totalSize?: number }>) {
  mockedHandleRequest.mockImplementation((request: { params?: { nextRecordsUrl?: string } }) => {
    const url = request.params?.nextRecordsUrl ?? '';
    const page = pagesByUrl[url];
    if (!page) {
      throw new Error(`Unexpected query locator: ${url}`);
    }
    return Promise.resolve({
      data: { queryResults: subquery(page.records, page.nextRecordsUrl, page.totalSize ?? page.records.length) },
    });
  });
}

describe('queryRemainingSubqueryResults', () => {
  beforeEach(() => {
    mockedHandleRequest.mockReset();
  });

  it('follows the locator until every child record is loaded', async () => {
    respondWith({
      '/next/contacts/1': { records: [record('003B', 'Contact')], nextRecordsUrl: '/next/contacts/2', totalSize: 3 },
      '/next/contacts/2': { records: [record('003C', 'Contact')], totalSize: 3 },
    });

    const results = await queryRemainingSubqueryResults(ORG, subquery([record('003A', 'Contact')], '/next/contacts/1', 3));

    expect(results.records.map(({ Id }: any) => Id)).toEqual(['003A', '003B', '003C']);
    expect(results.done).toBe(true);
    expect(mockedHandleRequest).toHaveBeenCalledTimes(2);
  });

  it('reports progress as child records arrive', async () => {
    respondWith({
      '/next/1': { records: [record('003B', 'Contact')], nextRecordsUrl: '/next/2' },
      '/next/2': { records: [record('003C', 'Contact')] },
    });
    const onProgress = vi.fn();

    await queryRemainingSubqueryResults(ORG, subquery([record('003A', 'Contact')], '/next/1'), false, onProgress);

    // queryRemaining follows the whole locator chain before returning, so this reports once per subquery completed
    expect(onProgress).toHaveBeenCalledWith(2);
  });

  it('completes subqueries nested inside the child records', async () => {
    const contactWithTruncatedCases = record('003A', 'Contact', {
      Cases: subquery([record('500A', 'Case')], '/next/cases', 2),
    });
    respondWith({ '/next/cases': { records: [record('500B', 'Case')], totalSize: 2 } });

    const results = await queryRemainingSubqueryResults(ORG, subquery([contactWithTruncatedCases]));

    expect(results.records[0].Cases.records.map(({ Id }: any) => Id)).toEqual(['500A', '500B']);
    expect(results.records[0].Cases.done).toBe(true);
  });

  it('completes a subquery three levels deep', async () => {
    const caseWithTruncatedComments = record('500A', 'Case', {
      CaseComments: subquery([record('00aA', 'CaseComment')], '/next/comments', 2),
    });
    const contact = record('003A', 'Contact', { Cases: subquery([caseWithTruncatedComments]) });
    respondWith({ '/next/comments': { records: [record('00aB', 'CaseComment')], totalSize: 2 } });

    const results = await queryRemainingSubqueryResults(ORG, subquery([contact]));

    expect(results.records[0].Cases.records[0].CaseComments.records.map(({ Id }: any) => Id)).toEqual(['00aA', '00aB']);
  });

  it('makes no requests when nothing was truncated', async () => {
    const results = await queryRemainingSubqueryResults(ORG, subquery([record('003A', 'Contact')]));

    expect(mockedHandleRequest).not.toHaveBeenCalled();
    expect(results.records).toHaveLength(1);
  });
});

describe('queryRemainingSubqueryRecords', () => {
  beforeEach(() => {
    mockedHandleRequest.mockReset();
  });

  it('returns the same array when no record is missing anything', async () => {
    const records = [record('001A', 'Account', { Contacts: subquery([record('003A', 'Contact')]) })];

    await expect(queryRemainingSubqueryRecords(ORG, records)).resolves.toBe(records);
    expect(mockedHandleRequest).not.toHaveBeenCalled();
  });

  it('completes truncated subqueries across every record without touching the originals', async () => {
    const records = [
      record('001A', 'Account', { Contacts: subquery([record('003A', 'Contact')], '/next/a', 2) }),
      record('001B', 'Account', { Contacts: subquery([record('003C', 'Contact')]) }),
    ];
    respondWith({ '/next/a': { records: [record('003B', 'Contact')], totalSize: 2 } });

    const completed = await queryRemainingSubqueryRecords(ORG, records);

    expect(completed[0].Contacts.records.map(({ Id }: any) => Id)).toEqual(['003A', '003B']);
    expect(completed[1]).toBe(records[1]);
    // The caller's copy is left alone - the table swaps in the returned records instead
    expect(records[0].Contacts.records).toHaveLength(1);
  });
});
