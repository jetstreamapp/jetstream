import { describe, expect, it, vi } from 'vitest';
import { toAuthErrorMessage } from '../api.service';

// api.service imports electron + electron-log + app config at module load; stub them so the pure
// message helper can be imported in a plain node environment. vitest hoists vi.mock above imports.
vi.mock('electron', () => ({
  app: { getVersion: vi.fn(() => '1.0.0') },
  net: { fetch: vi.fn() },
}));
vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../config/environment', () => ({ ENV: { SERVER_URL: 'https://server.test' } }));

describe('toAuthErrorMessage', () => {
  it('returns the server-provided data.error verbatim when present', () => {
    expect(toAuthErrorMessage(401, { success: false, error: 'Invalid session' }, { message: 'Unauthorized' })).toBe('Invalid session');
  });

  it('tailors the message for the not_entitled reason', () => {
    const message = toAuthErrorMessage(401, { skipLogout: true, reason: 'not_entitled' }, { message: 'Unauthorized' });
    expect(message).toContain('not enabled');
  });

  it('tailors the message for the inactive reason', () => {
    const message = toAuthErrorMessage(401, { skipLogout: true, reason: 'inactive' }, { message: 'Unauthorized' });
    expect(message).toContain('not active');
  });

  it('returns a friendly session message for a 401 with the skipLogout shape', () => {
    // This is the exact shape that previously produced "Unexpected response shape from server".
    const message = toAuthErrorMessage(401, { skipLogout: true }, { message: 'Unauthorized' });
    expect(message).toBe('Your session is invalid or has expired. Please sign in again.');
  });

  it('falls back to a meaningful top-level message for non-401 responses', () => {
    expect(toAuthErrorMessage(400, {}, { message: 'Some specific problem' })).toBe('Some specific problem');
  });

  it('skips the bare "Unauthorized" top-level message and uses the generic fallback', () => {
    expect(toAuthErrorMessage(403, {}, { message: 'Unauthorized' })).toBe('Unexpected response from server (status 403).');
  });

  it('uses the generic fallback when there is no usable information', () => {
    expect(toAuthErrorMessage(500, undefined, undefined)).toBe('Unexpected response from server (status 500).');
  });
});
