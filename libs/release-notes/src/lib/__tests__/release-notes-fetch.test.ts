import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchReleaseNotes, RELEASE_NOTES_URL } from '../release-notes-fetch';

const validNote = {
  slug: 'v10.0.0',
  title: '10.0.0 - Example',
  date: '2026-01-15',
  tags: ['web'],
  summary: 'Example release',
  highlights: [{ title: 'Example highlight' }],
};

function mockFetchResponse(response: Partial<Response>) {
  const fetchMock = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('fetchReleaseNotes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches and parses valid release notes without credentials', async () => {
    const fetchMock = mockFetchResponse({ ok: true, json: async () => [validNote] });

    const notes = await fetchReleaseNotes();

    expect(fetchMock).toHaveBeenCalledWith(RELEASE_NOTES_URL, { credentials: 'omit' });
    expect(notes).toEqual([validNote]);
  });

  it('skips invalid entries but keeps valid ones', async () => {
    mockFetchResponse({ ok: true, json: async () => [validNote, { slug: 'v-bad' }] });

    const notes = await fetchReleaseNotes();

    expect(notes).toEqual([validNote]);
  });

  it('returns an empty array when the payload is not an array', async () => {
    mockFetchResponse({ ok: true, json: async () => ({ notes: [validNote] }) });

    expect(await fetchReleaseNotes()).toEqual([]);
  });

  it('returns an empty array on a non-2xx response', async () => {
    mockFetchResponse({ ok: false, status: 404 });

    expect(await fetchReleaseNotes()).toEqual([]);
  });

  it('returns an empty array when fetch rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network error')));

    expect(await fetchReleaseNotes()).toEqual([]);
  });
});
