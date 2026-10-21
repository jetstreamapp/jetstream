import { net } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { verifyAuthToken } from '../api.service';

vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.0.0') },
  net: { fetch: vi.fn() },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../config/environment', () => ({ ENV: { SERVER_URL: 'https://server.test' } }));
vi.mock('../../utils/request-headers.utils', () => ({
  getDesktopRequestHeaders: vi.fn(() => ({ headers: {}, requestId: 'request-1' })),
}));

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * handleCheckAuthEvent signs the user out on any failure without `networkError`, so only a 401 may come back without it
 */
describe('verifyAuthToken', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a rejected session from the auth middleware as final', async () => {
    vi.mocked(net.fetch).mockResolvedValue(jsonResponse(401, { error: true, success: false, message: 'Unauthorized' }));

    const result = await verifyAuthToken({ accessToken: 'token', deviceId: 'device-1' });

    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('networkError');
  });

  it('reports a rejected session from the verify controller as final', async () => {
    vi.mocked(net.fetch).mockResolvedValue(jsonResponse(401, { data: { success: false, error: 'Invalid session' } }));

    const result = await verifyAuthToken({ accessToken: 'token', deviceId: 'device-1' });

    expect(result).toEqual({ success: false, error: 'Invalid session' });
  });

  it('reports a temporary server failure as a network error so the session is kept', async () => {
    vi.mocked(net.fetch).mockResolvedValue(
      jsonResponse(503, { data: { success: false, error: 'Unable to verify your session, please try again later' } }),
    );

    const result = await verifyAuthToken({ accessToken: 'token', deviceId: 'device-1' });

    expect(result).toEqual({ success: false, networkError: true, error: 'Unable to verify your session, please try again later' });
  });

  it.each([500, 429])('reports a %s from the API error handler as a network error so the session is kept', async (status) => {
    vi.mocked(net.fetch).mockResolvedValue(jsonResponse(status, { error: true, success: false, message: 'Something went wrong' }));

    const result = await verifyAuthToken({ accessToken: 'token', deviceId: 'device-1' });

    expect(result).toEqual(expect.objectContaining({ success: false, networkError: true }));
  });
});
