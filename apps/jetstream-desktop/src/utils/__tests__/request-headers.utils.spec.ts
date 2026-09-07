import { HTTP, HTTP_SOURCE_DESKTOP } from '@jetstream/shared/constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDesktopRequestHeaders } from '../request-headers.utils';

const mockApp = {
  getVersion: vi.fn(() => '10.15.2'),
  isPackaged: true,
  runningUnderARM64Translation: false as boolean | undefined,
};

vi.mock('electron', () => ({
  get app() {
    return mockApp;
  },
}));

const mockIsFreshProfile = vi.fn(() => false);
vi.mock('../../services/persistence.service', () => ({
  isFreshProfile: () => mockIsFreshProfile(),
}));

// Electron adds getSystemVersion to process; vitest runs under plain node, which does not have it
Object.assign(process, { getSystemVersion: () => '12.7.6' });

describe('getDesktopRequestHeaders', () => {
  beforeEach(() => {
    mockApp.isPackaged = true;
    mockApp.runningUnderARM64Translation = false;
    mockIsFreshProfile.mockReturnValue(false);
  });

  it('should report the host environment, app version and source', () => {
    const { headers } = getDesktopRequestHeaders();

    expect(headers[HTTP.HEADERS.X_SOURCE]).toBe(HTTP_SOURCE_DESKTOP);
    expect(headers[HTTP.HEADERS.X_APP_VERSION]).toBe('10.15.2');
    expect(headers[HTTP.HEADERS.X_CLIENT_PLATFORM]).toBe(process.platform);
    expect(headers[HTTP.HEADERS.X_CLIENT_ARCH]).toBe(process.arch);
    expect(headers[HTTP.HEADERS.X_CLIENT_OS_VERSION]).toBe('12.7.6');
    expect(headers[HTTP.HEADERS.X_CLIENT_RUNTIME]).toContain('chrome/');
    expect(headers[HTTP.HEADERS.X_CLIENT_INSTALL]).toBe('packaged');
  });

  it('should omit auth headers when there is no session', () => {
    const { headers } = getDesktopRequestHeaders();

    expect(headers[HTTP.HEADERS.AUTHORIZATION]).toBeUndefined();
    expect(headers[HTTP.HEADERS.X_EXT_DEVICE_ID]).toBeUndefined();
  });

  it('should include auth headers when a session exists', () => {
    const { headers } = getDesktopRequestHeaders({ deviceId: 'device-1', accessToken: 'token-1' });

    expect(headers[HTTP.HEADERS.AUTHORIZATION]).toBe('Bearer token-1');
    expect(headers[HTTP.HEADERS.X_EXT_DEVICE_ID]).toBe('device-1');
  });

  it('should issue a unique request id per request, and return the same id it sends', () => {
    const first = getDesktopRequestHeaders();
    const second = getDesktopRequestHeaders();

    expect(first.requestId).toBe(first.headers[HTTP.HEADERS.X_CLIENT_REQUEST_ID]);
    expect(first.requestId).not.toBe(second.requestId);
  });

  it('should flag an architecture that is being translated', () => {
    mockApp.runningUnderARM64Translation = true;

    expect(getDesktopRequestHeaders().headers[HTTP.HEADERS.X_CLIENT_ARCH]).toBe(`${process.arch}-translated`);
  });

  it('should not flag translation on platforms that do not report it', () => {
    mockApp.runningUnderARM64Translation = undefined;

    expect(getDesktopRequestHeaders().headers[HTTP.HEADERS.X_CLIENT_ARCH]).toBe(process.arch);
  });

  it('should report a fresh profile, which repeats on every launch when userData is not persisting', () => {
    mockApp.isPackaged = false;
    mockIsFreshProfile.mockReturnValue(true);

    expect(getDesktopRequestHeaders().headers[HTTP.HEADERS.X_CLIENT_INSTALL]).toBe('dev,fresh-profile');
  });

  it('should re-evaluate the install descriptor per request, since app data loads lazily', () => {
    expect(getDesktopRequestHeaders().headers[HTTP.HEADERS.X_CLIENT_INSTALL]).toBe('packaged');

    mockIsFreshProfile.mockReturnValue(true);
    expect(getDesktopRequestHeaders().headers[HTTP.HEADERS.X_CLIENT_INSTALL]).toBe('packaged,fresh-profile');
  });
});
