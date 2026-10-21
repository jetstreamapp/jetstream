import { ADMIN_REQUEST_HEADER } from '@jetstream/admin/types';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApiError, apiGet, apiPost, getLoginPath, getSafeReturnTo, unauthorizedHandler, useApiQuery } from '../admin-api-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('admin-api-client', () => {
  const originalUnauthorizedHandler = unauthorizedHandler.current;
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    unauthorizedHandler.current = originalUnauthorizedHandler;
    vi.unstubAllGlobals();
  });

  it('unwraps the data envelope and sends the admin request header', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { data: { email: 'admin@getjetstream.app' } }));

    const result = await apiGet<{ email: string }>('/api/me');

    expect(result).toEqual({ email: 'admin@getjetstream.app' });
    const [path, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(path).toBe('/api/me');
    expect(headers?.[ADMIN_REQUEST_HEADER]).toBe('1');
    expect(init?.credentials).toBe('same-origin');
    expect(init?.body).toBeUndefined();
  });

  it('calls the unauthorized handler and throws on a 401', async () => {
    const onUnauthorized = vi.fn();
    unauthorizedHandler.current = onUnauthorized;
    fetchMock.mockResolvedValue(jsonResponse(401, { error: true, message: 'Unauthorized' }));

    await expect(apiGet('/api/teams')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('surfaces the API error message', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409, { error: true, message: 'Customer is already linked to a team' }));

    const request = apiPost('/api/teams', { name: 'Acme' });

    await expect(request).rejects.toBeInstanceOf(AdminApiError);
    await expect(request).rejects.toThrow('Customer is already linked to a team');
  });

  it('resolves undefined for 204 responses', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiPost('/auth/logout')).resolves.toBeUndefined();
  });
});

describe('getSafeReturnTo', () => {
  it.each([
    [null, '/'],
    ['', '/'],
    ['https://evil.example.com', '/'],
    ['//evil.example.com', '/'],
    ['/\\evil.example.com', '/'],
    ['/login?returnTo=/teams', '/'],
    ['/teams/123?tab=billing', '/teams/123?tab=billing'],
  ])('maps %s to %s', (returnTo, expected) => {
    expect(getSafeReturnTo(returnTo)).toBe(expected);
  });

  it('builds an encoded login path', () => {
    expect(getLoginPath('/teams?query=acme')).toBe('/login?returnTo=%2Fteams%3Fquery%3Dacme');
  });
});

describe('useApiQuery', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not fetch when the path is null', () => {
    const { result } = renderHook(() => useApiQuery<string>(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('loads data, then keeps it while a reload is in flight', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: 'first' }));
    const { result } = renderHook(() => useApiQuery<string>('/api/dashboard'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.data).toBe('first'));
    expect(result.current.loading).toBe(false);

    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: true, message: 'Database unavailable' }));
    act(() => result.current.reload());

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('first');
    await waitFor(() => expect(result.current.error?.message).toBe('Database unavailable'));
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe('first');
  });

  it("never returns another path's data, including after the new path fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: 'team-a' }));
    const { result, rerender } = renderHook(({ path }) => useApiQuery<string>(path), { initialProps: { path: '/api/teams/a' } });
    await waitFor(() => expect(result.current.data).toBe('team-a'));

    fetchMock.mockResolvedValueOnce(jsonResponse(500, { error: true, message: 'Database unavailable' }));
    rerender({ path: '/api/teams/b' });

    expect(result.current.data).toBeNull();
    await waitFor(() => expect(result.current.error?.message).toBe('Database unavailable'));
    expect(result.current.data).toBeNull();
  });

  it("keeps the previous path's data when asked to", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: 'first page' }));
    const { result, rerender } = renderHook(({ path }) => useApiQuery<string>(path, { keepPreviousData: true }), {
      initialProps: { path: '/api/teams?page=1' },
    });
    await waitFor(() => expect(result.current.data).toBe('first page'));

    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: 'second page' }));
    rerender({ path: '/api/teams?page=2' });

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe('first page');
    await waitFor(() => expect(result.current.data).toBe('second page'));
  });
});
